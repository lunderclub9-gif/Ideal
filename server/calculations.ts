import { getDb } from './db.ts';

export interface IrgBracket {
  min: number;
  max: number | null;
  rate: number;
}

export interface TaxConfig {
  exemptBelow: number;
  abatementRate: number;
  abatementMin: number;
  abatementMax: number;
  brackets: IrgBracket[];
}

export const DEFAULT_TAX_CONFIG: TaxConfig = {
  exemptBelow: 30000,
  abatementRate: 0.4,
  abatementMin: 1000,
  abatementMax: 1500,
  brackets: [
    { min: 0, max: 20000, rate: 0 },
    { min: 20000, max: 40000, rate: 0.23 },
    { min: 40000, max: 80000, rate: 0.27 },
    { min: 80000, max: 160000, rate: 0.3 },
    { min: 160000, max: 320000, rate: 0.33 },
    { min: 320000, max: null, rate: 0.35 },
  ],
};

export function round2(val: number): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getTaxRate(code: string, fallback = 0): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT rate FROM tax_rules
       WHERE code = ? AND status = 'active'
       ORDER BY effective_date DESC, id DESC LIMIT 1`
    )
    .get(code) as { rate: number } | undefined;
  return row ? Number(row.rate) : fallback;
}

export function getTaxConfigFromDb(): TaxConfig {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT config_json FROM tax_rules
       WHERE code = 'IRG_BAREME' AND status = 'active'
       ORDER BY effective_date DESC, id DESC LIMIT 1`
    )
    .get() as { config_json?: string } | undefined;

  if (!row?.config_json) return DEFAULT_TAX_CONFIG;
  try {
    const parsed = JSON.parse(row.config_json);
    return {
      exemptBelow: Number(parsed.exemptBelow ?? DEFAULT_TAX_CONFIG.exemptBelow),
      abatementRate: Number(parsed.abatementRate ?? DEFAULT_TAX_CONFIG.abatementRate),
      abatementMin: Number(parsed.abatementMin ?? DEFAULT_TAX_CONFIG.abatementMin),
      abatementMax: Number(parsed.abatementMax ?? DEFAULT_TAX_CONFIG.abatementMax),
      brackets: Array.isArray(parsed.brackets) && parsed.brackets.length > 0 ? parsed.brackets : DEFAULT_TAX_CONFIG.brackets,
    };
  } catch {
    return DEFAULT_TAX_CONFIG;
  }
}

export function calculateAlgerianIRG(taxableMonthly: number, config: TaxConfig = DEFAULT_TAX_CONFIG): number {
  const income = Math.max(0, Number(taxableMonthly) || 0);
  if (income <= config.exemptBelow) return 0;

  let grossTax = 0;
  for (const b of config.brackets) {
    if (income <= b.min) break;
    const upper = b.max === null ? income : Math.min(income, b.max);
    const slice = Math.max(0, upper - b.min);
    grossTax += slice * b.rate;
  }

  const abatement = Math.min(config.abatementMax, Math.max(config.abatementMin, grossTax * config.abatementRate));
  const netIrg = Math.max(0, grossTax - abatement);
  return Math.round(netIrg);
}

export interface ProjectFinancials {
  project_id: number;
  expected_selling_price: number;
  expected_cost: number;
  approved_avenants_price: number;
  approved_avenants_cost: number;
  revised_contract_value: number;
  revised_budget_cost: number;
  materials_cost: number;
  labor_cost: number;
  fuel_cost: number;
  repairs_cost: number;
  equipment_cost: number;
  direct_expenses_cost: number;
  direct_cost_total: number;
  overhead_cost: number;
  total_actual_cost: number;
  budget_variance: number;
  invoiced_ht: number;
  invoiced_ttc: number;
  collected_cash: number;
  remaining_to_collect: number;
  net_profit: number;
  margin_percent: number;
}

export function calculateProjectFinancials(projectId: number): ProjectFinancials {
  const db = getDb();
  const project = db
    .prepare('SELECT id, expected_cost, expected_selling_price, include_overhead FROM projects WHERE id = ?')
    .get(projectId) as
    | { id: number; expected_cost: number; expected_selling_price: number; include_overhead: number }
    | undefined;

  if (!project) {
    return {
      project_id: projectId,
      expected_selling_price: 0,
      expected_cost: 0,
      approved_avenants_price: 0,
      approved_avenants_cost: 0,
      revised_contract_value: 0,
      revised_budget_cost: 0,
      materials_cost: 0,
      labor_cost: 0,
      fuel_cost: 0,
      repairs_cost: 0,
      equipment_cost: 0,
      direct_expenses_cost: 0,
      direct_cost_total: 0,
      overhead_cost: 0,
      total_actual_cost: 0,
      budget_variance: 0,
      invoiced_ht: 0,
      invoiced_ttc: 0,
      collected_cash: 0,
      remaining_to_collect: 0,
      net_profit: 0,
      margin_percent: 0,
    };
  }

  const avenantRow = db
    .prepare(
      `SELECT COALESCE(SUM(additional_price), 0) AS add_price,
              COALESCE(SUM(additional_cost), 0) AS add_cost
       FROM change_orders
       WHERE project_id = ? AND approval_status = 'approved'`
    )
    .get(projectId) as { add_price: number; add_cost: number };

  // Materials issued to project minus returns (stock exit = consumption cost, avoiding purchase double counting)
  const matRow = db
    .prepare(
      `SELECT COALESCE(SUM(
         CASE WHEN movement_type = 'exit' THEN total_cost
              WHEN movement_type = 'return' THEN -total_cost
              ELSE 0 END
       ), 0) AS cost
       FROM stock_movements
       WHERE project_id = ?`
    )
    .get(projectId) as { cost: number };

  // Approved attendance labor cost allocated to project
  const laborRows = db
    .prepare(
      `SELECT a.status, a.day_fraction, a.overtime_hours,
              w.wage_type, w.daily_wage, w.hourly_rate, w.monthly_salary
       FROM attendance a
       JOIN workers w ON w.id = a.worker_id
       WHERE a.project_id = ? AND a.approval_status = 'approved'`
    )
    .all(projectId) as Array<{
    status: string;
    day_fraction: number;
    overtime_hours: number;
    wage_type: string;
    daily_wage: number;
    hourly_rate: number;
    monthly_salary: number;
  }>;

  let laborCost = 0;
  for (const r of laborRows) {
    const isPaidDay = ['present', 'half_day', 'paid_leave', 'holiday'].includes(r.status);
    const days = isPaidDay ? Number(r.day_fraction || 0) : 0;
    const ot = Number(r.overtime_hours || 0);
    if (r.wage_type === 'monthly') {
      const dailyEq = Number(r.monthly_salary || 0) / 22;
      const hourlyEq = Number(r.monthly_salary || 0) / 176;
      laborCost += days * dailyEq + ot * hourlyEq * 1.5;
    } else if (r.wage_type === 'hourly') {
      laborCost += days * 8 * Number(r.hourly_rate || 0) + ot * Number(r.hourly_rate || 0) * 1.5;
    } else {
      const dw = Number(r.daily_wage || 0);
      laborCost += days * dw + ot * (dw / 8) * 1.5;
    }
  }

  const fuelRow = db
    .prepare('SELECT COALESCE(SUM(total_cost), 0) AS cost FROM fuel_entries WHERE project_id = ?')
    .get(projectId) as { cost: number };

  const repairRow = db
    .prepare('SELECT COALESCE(SUM(total_cost), 0) AS cost FROM repair_orders WHERE project_id = ?')
    .get(projectId) as { cost: number };

  const equipRow = db
    .prepare(
      `SELECT COALESCE(SUM((COALESCE(pa.usage_hours, 0) / 8.0) * COALESCE(v.usage_rate_per_day, 0)), 0) AS cost
       FROM project_assignments pa
       JOIN vehicles v ON v.id = pa.vehicle_id
       WHERE pa.project_id = ?`
    )
    .get(projectId) as { cost: number };

  const expRow = db
    .prepare('SELECT COALESCE(SUM(amount), 0) AS cost FROM expenses WHERE project_id = ? AND is_overhead = 0')
    .get(projectId) as { cost: number };

  const materialsCost = round2(Math.max(0, matRow.cost));
  const roundedLabor = round2(laborCost);
  const fuelCost = round2(fuelRow.cost);
  const repairsCost = round2(repairRow.cost);
  const equipmentCost = round2(equipRow.cost);
  const directExpensesCost = round2(expRow.cost);

  const directCostTotal = round2(
    materialsCost + roundedLabor + fuelCost + repairsCost + equipmentCost + directExpensesCost
  );

  let overheadCost = 0;
  if (project.include_overhead) {
    const settings = db.prepare('SELECT overhead_rate_percent FROM company_settings WHERE id = 1').get() as
      | { overhead_rate_percent?: number }
      | undefined;
    const ohRate = Number(settings?.overhead_rate_percent ?? 8);
    overheadCost = round2(directCostTotal * (ohRate / 100));
  }

  const totalActualCost = round2(directCostTotal + overheadCost);
  const approvedAvenantsPrice = round2(avenantRow.add_price);
  const approvedAvenantsCost = round2(avenantRow.add_cost);
  const revisedContractValue = round2(Number(project.expected_selling_price || 0) + approvedAvenantsPrice);
  const revisedBudgetCost = round2(Number(project.expected_cost || 0) + approvedAvenantsCost);
  const budgetVariance = round2(revisedBudgetCost - totalActualCost);

  const invRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN doc_type = 'facture' AND status NOT IN ('draft','cancelled') THEN total_ht
                           WHEN doc_type = 'avoir' AND status NOT IN ('draft','cancelled') THEN -total_ht ELSE 0 END), 0) AS ht,
         COALESCE(SUM(CASE WHEN doc_type = 'facture' AND status NOT IN ('draft','cancelled') THEN total_ttc
                           WHEN doc_type = 'avoir' AND status NOT IN ('draft','cancelled') THEN -total_ttc ELSE 0 END), 0) AS ttc,
         COALESCE(SUM(CASE WHEN doc_type = 'facture' AND status NOT IN ('draft','cancelled') THEN amount_paid ELSE 0 END), 0) AS paid
       FROM commercial_documents
       WHERE project_id = ?`
    )
    .get(projectId) as { ht: number; ttc: number; paid: number };

  const invoicedHt = round2(invRow.ht);
  const invoicedTtc = round2(invRow.ttc);
  const collectedCash = round2(invRow.paid);
  const remainingToCollect = round2(Math.max(0, invoicedTtc - collectedCash));
  const netProfit = round2(invoicedHt - totalActualCost);
  const marginPercent = invoicedHt > 0 ? round2((netProfit / invoicedHt) * 100) : 0;

  return {
    project_id: projectId,
    expected_selling_price: round2(project.expected_selling_price),
    expected_cost: round2(project.expected_cost),
    approved_avenants_price: approvedAvenantsPrice,
    approved_avenants_cost: approvedAvenantsCost,
    revised_contract_value: revisedContractValue,
    revised_budget_cost: revisedBudgetCost,
    materials_cost: materialsCost,
    labor_cost: roundedLabor,
    fuel_cost: fuelCost,
    repairs_cost: repairsCost,
    equipment_cost: equipmentCost,
    direct_expenses_cost: directExpensesCost,
    direct_cost_total: directCostTotal,
    overhead_cost: overheadCost,
    total_actual_cost: totalActualCost,
    budget_variance: budgetVariance,
    invoiced_ht: invoicedHt,
    invoiced_ttc: invoicedTtc,
    collected_cash: collectedCash,
    remaining_to_collect: remainingToCollect,
    net_profit: netProfit,
    margin_percent: marginPercent,
  };
}

export function generateNextNumber(
  prefix: string,
  table: string,
  column: string,
  extraWhere = ''
): string {
  const db = getDb();
  const year = new Date().getFullYear();
  const pattern = `${prefix}-${year}-%`;
  const rows = db
    .prepare(`SELECT ${column} AS num FROM ${table} WHERE ${column} LIKE ? ${extraWhere}`)
    .all(pattern) as Array<{ num: string }>;

  let maxSeq = 0;
  for (const r of rows) {
    const parts = String(r.num || '').split('-');
    const last = Number(parts[parts.length - 1]);
    if (Number.isFinite(last) && last > maxSeq) {
      maxSeq = last;
    }
  }
  return `${prefix}-${year}-${String(maxSeq + 1).padStart(4, '0')}`;
}

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];
const TENS = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];

function convertBelowThousand(n: number): string {
  if (n === 0) return '';
  if (n < 20) return UNITS[n];
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const unit = n % 10;
    if (ten === 7 || ten === 9) {
      const base = TENS[ten - 1];
      const rem = 10 + unit;
      if (ten === 7 && unit === 1) return 'soixante et onze';
      return `${base}-${UNITS[rem]}`;
    }
    if (unit === 0) return ten === 8 ? 'quatre-vingts' : TENS[ten];
    if (unit === 1 && ten !== 8) return `${TENS[ten]} et un`;
    return `${TENS[ten]}-${UNITS[unit]}`;
  }
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const hWord = hundred === 1 ? 'cent' : `${UNITS[hundred]} cent${rest === 0 ? 's' : ''}`;
  return rest === 0 ? hWord : `${hWord} ${convertBelowThousand(rest)}`;
}

function intToFrench(n: number): string {
  if (n === 0) return 'zéro';
  const parts: string[] = [];
  const billions = Math.floor(n / 1_000_000_000);
  const millions = Math.floor((n % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1_000);
  const remainder = n % 1_000;

  if (billions > 0) parts.push(`${convertBelowThousand(billions)} milliard${billions > 1 ? 's' : ''}`);
  if (millions > 0) parts.push(`${convertBelowThousand(millions)} million${millions > 1 ? 's' : ''}`);
  if (thousands > 0) parts.push(thousands === 1 ? 'mille' : `${convertBelowThousand(thousands)} mille`);
  if (remainder > 0) parts.push(convertBelowThousand(remainder));
  return parts.join(' ');
}

export function amountToFrenchWords(amount: number): string {
  const safe = Math.abs(round2(amount));
  const intPart = Math.floor(safe);
  const cents = Math.round((safe - intPart) * 100);

  const dinarsStr = `${intToFrench(intPart)} dinar${intPart > 1 ? 's' : ''} algérien${intPart > 1 ? 's' : ''}`;
  const full = cents > 0 ? `${dinarsStr} et ${intToFrench(cents)} centime${cents > 1 ? 's' : ''}` : dinarsStr;
  return full.charAt(0).toUpperCase() + full.slice(1);
}
