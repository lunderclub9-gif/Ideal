import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

// Isolated regression suite: verifies the actions that were only reachable from
// the API before this change (tax rules, project phases, contracts, milestone
// receipts, expense cancellation, treasury reversal) and that a cancelled
// expense no longer inflates cost indicators.

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideal-regressions-'));
const dataDir = path.join(tempRoot, 'data');
const port = await new Promise<number>((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') return reject(new Error('Could not reserve an isolated test port.'));
    const selected = address.port;
    probe.close((error) => (error ? reject(error) : resolve(selected)));
  });
});

const server = spawn(process.execPath, [path.resolve('node_modules/tsx/dist/cli.mjs'), 'server.ts'], {
  env: {
    ...process.env,
    IDEAL_DATA_DIR: dataDir,
    GESTIONPRO_DATA_DIR: dataDir,
    HOST: '127.0.0.1',
    PORT: String(port),
    NODE_ENV: 'development',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const base = `http://127.0.0.1:${port}/api`;
let ready = false;

async function stopServer() {
  if (server.exitCode !== null) return;
  try { server.kill('SIGTERM'); } catch {}
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 5000);
    server.once('exit', () => { clearTimeout(timer); resolve(); });
  });
}

async function request(route: string, method = 'GET', body?: unknown, token?: string) {
  const response = await fetch(base + route, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data: any;
  try { data = JSON.parse(raw); } catch { data = raw; }
  return { status: response.status, data };
}

try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Regression server startup timed out.')), 45000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('IDEAL_SERVER_READY')) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on('data', (chunk) => process.stderr.write('[regressions-server] ' + chunk.toString()));
    server.once('exit', (code) => {
      if (!ready) {
        clearTimeout(timeout);
        reject(new Error(`Regression server exited before readiness (code ${code}).`));
      }
    });
  });

  let r = await request('/auth/setup', 'POST', {
    companyName: 'IDEAL Regressions SARL',
    legalForm: 'SARL',
    fullName: 'Regression Admin',
    username: 'regression_admin',
    password: 'Regression-Password-2026',
  });
  assert.equal(r.status, 201, 'isolated first-run setup');
  const token = r.data.token as string;
  const today = new Date().toISOString().slice(0, 10);

  // -------- Tax rules: create, validate, edit, archive --------
  r = await request('/taxes/summary', 'GET', undefined, token);
  assert.equal(r.status, 200, 'tax summary loads');
  assert.equal(r.data.rules.length, 0, 'tax rules start empty on a fresh install');

  r = await request('/taxes/rules', 'POST', { code: 'tva_test', name: 'TVA test', rate: 19, effective_date: today, notes: 'Régression' }, token);
  assert.equal(r.status, 201, 'create tax rule');
  const ruleId = Number(r.data.id);
  assert.equal(r.data.code, 'TVA_TEST', 'tax rule code is normalised to uppercase');
  assert.equal(r.data.status, 'active', 'new tax rule is active');

  r = await request('/taxes/summary', 'GET', undefined, token);
  assert.ok(r.data.rules.some((x: any) => x.id === ruleId), 'created tax rule is listed');

  r = await request('/taxes/rules', 'POST', { code: 'BAD CODE', name: 'Invalide', rate: 10 }, token);
  assert.equal(r.status, 400, 'invalid tax rule code is rejected');
  r = await request('/taxes/rules', 'POST', { code: 'TVA_BAD', name: 'Invalide', rate: 150 }, token);
  assert.equal(r.status, 400, 'rate above 100 is rejected');
  r = await request('/taxes/rules', 'POST', { code: 'TVA_BAD', name: 'Invalide', rate: 10, effective_date: '2026-02-31' }, token);
  assert.equal(r.status, 400, 'invalid effective date is rejected');

  r = await request(`/taxes/rules/${ruleId}`, 'PUT', { rate: 20 }, token);
  assert.equal(r.status, 200, 'update tax rule rate');
  assert.equal(Number(r.data.rate), 20, 'tax rule rate is updated');
  r = await request(`/taxes/rules/${ruleId}`, 'PUT', { status: 'archived' }, token);
  assert.equal(r.status, 200, 'archive tax rule');
  assert.equal(r.data.status, 'archived', 'tax rule is archived');
  r = await request(`/taxes/rules/${ruleId}`, 'PUT', { rate: 500 }, token);
  assert.equal(r.status, 400, 'out-of-range tax rate update is rejected');

  // -------- Tax rule uniqueness: one active rule per code and effective date --------
  r = await request('/taxes/rules', 'POST', { code: 'TVA_DUP', name: 'TVA doublon', rate: 19, effective_date: '2026-01-01' }, token);
  assert.equal(r.status, 201, 'first active rule for a code/date pair is accepted');
  const dupRuleA = Number(r.data.id);

  r = await request('/taxes/rules', 'POST', { code: 'TVA_DUP', name: 'TVA doublon', rate: 20, effective_date: '2026-01-01' }, token);
  assert.equal(r.status, 400, 'second active rule with the same code and effective date is rejected');
  assert.match(r.data.error, /existe déjà/i);

  r = await request('/taxes/rules', 'POST', { code: 'TVA_DUP', name: 'TVA doublon v2', rate: 20, effective_date: '2026-06-01' }, token);
  assert.equal(r.status, 201, 'same code with a different effective date is allowed for versioning');
  const dupRuleB = Number(r.data.id);

  r = await request(`/taxes/rules/${dupRuleB}`, 'PUT', { effective_date: '2026-01-01' }, token);
  assert.equal(r.status, 400, 'moving an active rule onto an existing code/date pair is rejected');

  r = await request(`/taxes/rules/${dupRuleA}`, 'PUT', { status: 'archived' }, token);
  assert.equal(r.status, 200, 'archiving a rule frees its code/date pair');
  r = await request('/taxes/rules', 'POST', { code: 'TVA_DUP', name: 'TVA doublon', rate: 21, effective_date: '2026-01-01' }, token);
  assert.equal(r.status, 201, 're-creating an archived code/date pair is allowed');
  r = await request(`/taxes/rules/${dupRuleA}`, 'PUT', { status: 'active' }, token);
  assert.equal(r.status, 400, 'reactivating a rule cannot create a duplicate active pair');

  // -------- IRG_BAREME is a bracket configuration, not a plain rate --------
  r = await request('/taxes/rules', 'POST', { code: 'IRG_BAREME', name: 'Barème IRG', rate: 35, effective_date: today }, token);
  assert.equal(r.status, 400, 'IRG_BAREME cannot be created as a plain rate');
  assert.match(r.data.error, /barème/i);

  // Seed the bracket row directly: the API deliberately refuses to create it as a rate.
  const Database = (await import('better-sqlite3')).default;
  const rawDb = new Database(path.join(dataDir, 'gestionpro.db'));
  const irgInfo = rawDb
    .prepare(
      "INSERT INTO tax_rules (code, name, rate, config_json, effective_date, status, notes, validated_by) VALUES ('IRG_BAREME', 'Barème IRG', 0, '{}', ?, 'active', '', 'test')"
    )
    .run(today);
  const irgId = Number(irgInfo.lastInsertRowid);
  rawDb.close();

  r = await request(`/taxes/rules/${irgId}`, 'PUT', { rate: 35 }, token);
  assert.equal(r.status, 400, 'IRG_BAREME cannot be edited through a plain rate');
  assert.match(r.data.error, /barème/i);

  r = await request(`/taxes/rules/${irgId}`, 'PUT', { notes: 'Barème à faire valider par le comptable' }, token);
  assert.equal(r.status, 200, 'IRG_BAREME stays editable for notes and status');
  assert.equal(r.data.notes, 'Barème à faire valider par le comptable', 'IRG_BAREME notes update persists');
  assert.equal(Number(r.data.rate), 0, 'IRG_BAREME rate is untouched by a notes update');

  // -------- Workflow records: client, project, phase, contract, milestones --------
  r = await request('/clients', 'POST', { name: 'Client Régression' }, token);
  assert.equal(r.status, 201, 'create client');
  const clientId = Number(r.data.id);
  r = await request('/projects', 'POST', { title: 'Chantier Régression', client_id: clientId, expected_cost: 0, expected_selling_price: 0 }, token);
  assert.equal(r.status, 201, 'create project');
  const projectId = Number(r.data.id);

  r = await request(`/projects/${projectId}/phases`, 'POST', { name: 'Gros œuvre', sort_order: 1, status: 'in_progress' }, token);
  assert.equal(r.status, 201, 'create project phase');
  assert.equal(r.data.name, 'Gros œuvre', 'phase name is stored');
  r = await request(`/projects/${projectId}/phases`, 'POST', { name: '   ' }, token);
  assert.equal(r.status, 400, 'empty phase name is rejected');

  r = await request('/contracts', 'POST', {
    client_id: clientId,
    project_id: projectId,
    contract_amount: 100000,
    retention_rate: 5,
    signing_date: today,
    start_date: today,
    milestones: [
      { title: 'Acompte 40%', due_date: today, expected_amount: 40000 },
      { title: 'Solde 60%', due_date: today, expected_amount: 60000 },
    ],
  }, token);
  assert.equal(r.status, 201, 'create contract');
  const contractId = Number(r.data.id);
  assert.equal(Number(r.data.retention_amount), 5000, 'retention amount is computed');

  r = await request(`/projects/${projectId}`, 'GET', undefined, token);
  assert.equal(r.status, 200, 'project detail loads');
  assert.equal(r.data.phases.length, 1, 'phase is linked to the project');
  assert.equal(r.data.contracts.length, 1, 'contract is linked to the project');
  const contract = r.data.contracts.find((c: any) => c.id === contractId);
  assert.equal(contract.milestones.length, 2, 'contract milestones are stored');
  const firstMilestone = contract.milestones[0];

  r = await request(`/contracts/milestones/${firstMilestone.id}`, 'PUT', { received_amount: 10000 }, token);
  assert.equal(r.status, 200, 'record partial milestone receipt');
  assert.equal(r.data.status, 'partial', 'partial receipt sets partial status');
  r = await request(`/contracts/milestones/${firstMilestone.id}`, 'PUT', { received_amount: 40000 }, token);
  assert.equal(r.data.status, 'paid', 'full receipt sets paid status');

  // -------- BOQ: versions, sections, items, rate analysis and approval --------
  r = await request(`/projects/${projectId}/boq`, 'GET', undefined, token);
  assert.equal(r.status, 200, 'BOQ list loads');
  assert.equal(r.data.versions.length, 0, 'a new project has no BOQ version');

  r = await request(`/projects/${projectId}/boq/versions`, 'POST', { label: 'Estimation initiale' }, token);
  assert.equal(r.status, 201, 'create BOQ version');
  const boqV1 = Number(r.data.id);
  assert.equal(r.data.version_number, 1, 'first BOQ version is numbered 1');
  assert.equal(r.data.status, 'draft', 'new BOQ version is a draft');

  r = await request(`/boq/versions/${boqV1}/sections`, 'POST', { code: 'A', title: 'Gros œuvre', sort_order: 1 }, token);
  assert.equal(r.status, 201, 'create BOQ section');
  const boqSectionId = Number(r.data.sections[0].id);
  assert.equal(r.data.sections.length, 1, 'section is stored');

  r = await request(
    `/boq/versions/${boqV1}/items`,
    'POST',
    { section_id: boqSectionId, code: 'A.1', description: 'Béton armé', unit: 'm³', quantity: 10, unit_price: 1000 },
    token
  );
  assert.equal(r.status, 201, 'create BOQ item');
  const boqItemId = Number(r.data.items[0].id);
  assert.equal(Number(r.data.items[0].line_ht), 10000, 'item total HT is quantity × unit price');
  assert.equal(Number(r.data.items[0].unit_cost), 0, 'item has no cost before rate analysis');

  r = await request(`/boq/items/${boqItemId}/resources`, 'POST', { resource_type: 'material', label: 'Ciment', unit: 'sac', quantity: 2, unit_cost: 150 }, token);
  assert.equal(r.status, 201, 'add material resource');
  r = await request(`/boq/items/${boqItemId}/resources`, 'POST', { resource_type: 'labour', label: 'Équipe', unit: 'jour', quantity: 3, unit_cost: 200 }, token);
  assert.equal(r.status, 201, 'add labour resource');
  assert.equal(Number(r.data.items[0].unit_cost), 900, 'unit cost is the resource breakdown total');
  assert.equal(Number(r.data.totals.total_ht), 10000, 'BOQ total HT is computed');
  assert.equal(Number(r.data.totals.total_cost), 9000, 'BOQ cost is computed');
  assert.equal(Number(r.data.totals.margin), 1000, 'BOQ margin is computed');
  assert.equal(Number(r.data.totals.margin_percent), 10, 'BOQ margin percent is computed');

  r = await request(`/boq/versions/${boqV1}/items`, 'POST', { description: 'Prix négatif', unit: 'U', quantity: -1, unit_price: -5 }, token);
  assert.equal(r.status, 400, 'negative BOQ quantity and price are rejected');
  r = await request(`/boq/versions/${boqV1}/items`, 'POST', { description: '   ', unit: 'U', quantity: 1, unit_price: 1 }, token);
  assert.equal(r.status, 400, 'empty BOQ item description is rejected');
  r = await request(`/boq/items/${boqItemId}/resources`, 'POST', { resource_type: 'magic', label: 'X', quantity: 1, unit_cost: 1 }, token);
  assert.equal(r.status, 400, 'unknown BOQ resource type is rejected');

  r = await request(`/projects/${projectId}/boq/versions`, 'POST', { label: 'Version vide' }, token);
  assert.equal(r.status, 201, 'create a second BOQ version');
  const boqEmpty = Number(r.data.id);
  r = await request(`/boq/versions/${boqEmpty}/approve`, 'POST', {}, token);
  assert.equal(r.status, 400, 'an empty BOQ version cannot be approved');

  r = await request(`/boq/versions/${boqV1}/duplicate`, 'POST', {}, token);
  assert.equal(r.status, 201, 'duplicate a BOQ version into a revision');
  const boqV3 = Number(r.data.id);
  assert.equal(r.data.status, 'draft', 'duplicated BOQ version is a draft');
  assert.equal(r.data.sections.length, 1, 'duplicated version keeps its sections');
  assert.equal(r.data.items.length, 1, 'duplicated version keeps its items');
  assert.equal(r.data.items[0].resources.length, 2, 'duplicated version keeps the rate analysis');
  assert.equal(Number(r.data.totals.total_ht), 10000, 'duplicated version keeps its totals');

  r = await request(`/boq/versions/${boqV1}/approve`, 'POST', {}, token);
  assert.equal(r.status, 200, 'approve a BOQ version');
  assert.equal(r.data.status, 'approved', 'approved BOQ status is stored');

  r = await request(`/boq/items/${boqItemId}`, 'PUT', { unit_price: 1200 }, token);
  assert.equal(r.status, 400, 'an approved BOQ version can no longer be edited');

  r = await request(`/boq/versions/${boqV3}/approve`, 'POST', {}, token);
  assert.equal(r.status, 200, 'approve the BOQ revision');
  r = await request(`/projects/${projectId}/boq`, 'GET', undefined, token);
  assert.equal(r.data.versions.find((v: any) => v.id === boqV3).status, 'approved', 'latest approved BOQ is the reference');
  assert.equal(r.data.versions.find((v: any) => v.id === boqV1).status, 'superseded', 'previous approved BOQ is superseded');

  // -------- Cancelled expense must stop counting as a cost --------
  r = await request('/expenses', 'POST', {
    category: 'Transport',
    description: 'Dépense à annuler',
    amount: 5000,
    payment_method: 'Espèces',
    project_id: projectId,
  }, token);
  assert.equal(r.status, 201, 'create expense');
  const expenseId = Number(r.data.id);

  r = await request(`/projects/${projectId}`, 'GET', undefined, token);
  assert.equal(Number(r.data.financials.direct_expenses_cost), 5000, 'expense counts in project cost before cancellation');
  r = await request('/dashboard', 'GET', undefined, token);
  assert.equal(Number(r.data.kpis.totalCosts), 5000, 'expense counts in dashboard costs before cancellation');
  r = await request('/treasury', 'GET', undefined, token);
  assert.equal(Number(r.data.cashBalance), -5000, 'cash expense reduces the cash balance');

  r = await request(`/expenses/${expenseId}/cancel`, 'POST', { reason: 'Régression' }, token);
  assert.equal(r.status, 200, 'cancel expense');
  assert.equal(r.data.status, 'cancelled', 'expense is marked cancelled');
  r = await request(`/expenses/${expenseId}/cancel`, 'POST', {}, token);
  assert.equal(r.status, 400, 'cancelling twice is refused');

  r = await request(`/projects/${projectId}`, 'GET', undefined, token);
  assert.equal(Number(r.data.financials.direct_expenses_cost), 0, 'cancelled expense no longer counts in project cost');
  r = await request('/dashboard', 'GET', undefined, token);
  assert.equal(Number(r.data.kpis.totalCosts), 0, 'cancelled expense no longer counts in dashboard costs');
  r = await request('/treasury', 'GET', undefined, token);
  assert.equal(Number(r.data.cashBalance), 0, 'expense cancellation counter-passes the cash movement');
  r = await request('/expenses', 'GET', undefined, token);
  const listedExpense = r.data.find((e: any) => e.id === expenseId);
  assert.equal(listedExpense.status, 'cancelled', 'cancelled expense remains visible in the history');

  // -------- Treasury reversal keeps balances net and history intact --------
  r = await request('/treasury/transactions', 'POST', { tx_type: 'cash_inflow', amount: 1000, notes: 'Apport à contre-passer' }, token);
  assert.equal(r.status, 201, 'create treasury transaction');
  const txId = Number(r.data.id);
  r = await request('/treasury', 'GET', undefined, token);
  assert.equal(Number(r.data.cashBalance), 1000, 'cash inflow is counted');

  r = await request(`/treasury/transactions/${txId}/reverse`, 'POST', { reason: 'Régression' }, token);
  assert.equal(r.status, 201, 'reverse treasury transaction');
  r = await request(`/treasury/transactions/${txId}/reverse`, 'POST', {}, token);
  assert.equal(r.status, 400, 'reversing twice is refused');
  r = await request('/treasury', 'GET', undefined, token);
  assert.equal(Number(r.data.cashBalance), 0, 'reversal nets the cash balance to zero');
  const reversedOriginal = r.data.transactions.find((t: any) => t.id === txId);
  assert.equal(reversedOriginal.status, 'reversed', 'original transaction is kept and flagged');

  // -------- Permissions are enforced on the new endpoints --------
  r = await request('/users', 'POST', { name: 'Chauffeur Test', username: 'driver_test', password: 'Driver-Password-2026', role: 'driver' }, token);
  assert.equal(r.status, 201, 'create driver user');
  r = await request('/users', 'POST', { name: 'Magasinier Test', username: 'store_test', password: 'Store-Password-2026', role: 'storekeeper' }, token);
  assert.equal(r.status, 201, 'create storekeeper user');

  r = await request('/auth/login', 'POST', { username: 'driver_test', password: 'Driver-Password-2026' });
  assert.equal(r.status, 200, 'driver login');
  const driverToken = r.data.token as string;
  r = await request('/taxes/rules', 'POST', { code: 'DRIVER_RULE', name: 'Interdit', rate: 1 }, driverToken);
  assert.equal(r.status, 403, 'driver cannot create tax rules');
  r = await request('/taxes/summary', 'GET', undefined, driverToken);
  assert.equal(r.status, 403, 'driver cannot read the tax summary');
  r = await request(`/boq/versions/${boqV3}/approve`, 'POST', {}, driverToken);
  assert.equal(r.status, 403, 'driver cannot approve a BOQ version');

  r = await request('/auth/login', 'POST', { username: 'store_test', password: 'Store-Password-2026' });
  assert.equal(r.status, 200, 'storekeeper login');
  const storeToken = r.data.token as string;
  r = await request(`/clients/${clientId}`, 'DELETE', undefined, storeToken);
  assert.equal(r.status, 403, 'storekeeper cannot permanently delete a client');
  r = await request(`/expenses/${expenseId}/cancel`, 'POST', {}, storeToken);
  assert.equal(r.status, 403, 'storekeeper cannot cancel expenses');
  r = await request(`/projects/${projectId}/boq/versions`, 'POST', { label: 'Interdit' }, storeToken);
  assert.equal(r.status, 403, 'storekeeper cannot create a BOQ version');

  assert.ok(fs.existsSync(path.join(dataDir, 'gestionpro.db')), 'database lives inside the isolated temporary directory');

  console.log('REGRESSION_TESTS_OK: tax rules, phases, contracts, milestone receipts, expense cancellation accounting, treasury reversal and role permissions.');
  console.log('REGRESSION_DATA_ISOLATED:', dataDir);
} catch (error: any) {
  console.error('REGRESSION_TESTS_FAILED:', error?.stack || error);
  process.exitCode = 1;
} finally {
  await stopServer();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
