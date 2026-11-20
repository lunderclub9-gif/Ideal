import { getDb } from './db';

export const LIFECYCLE_NEW_DAYS = 7;

function addDays(iso: string, days: number): string {
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

function nowIso(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

export function isDeletionEligible(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date().toISOString().slice(0, 19).replace('T', ' ') <= deadline;
}

export function clientDependencies(clientId: number): string[] {
  const db = getDb();
  const deps: string[] = [];
  const projects = db.prepare('SELECT COUNT(*) c FROM projects WHERE client_id = ?').get(clientId) as any;
  if (projects.c > 0) deps.push(`${projects.c} chantier(s)`);
  const docs = db.prepare('SELECT COUNT(*) c FROM commercial_documents WHERE client_id = ?').get(clientId) as any;
  if (docs.c > 0) deps.push(`${docs.c} pièce(s) commerciale(s)`);
  const payments = db.prepare('SELECT COUNT(*) c FROM payments WHERE client_id = ?').get(clientId) as any;
  if (payments.c > 0) deps.push(`${payments.c} règlement(s)`);
  return deps;
}

export function projectDependencies(projectId: number): string[] {
  const db = getDb();
  const deps: string[] = [];
  const docs = db.prepare('SELECT COUNT(*) c FROM commercial_documents WHERE project_id = ?').get(projectId) as any;
  if (docs.c > 0) deps.push(`${docs.c} pièce(s) commerciale(s)`);
  const expenses = db.prepare('SELECT COUNT(*) c FROM expenses WHERE project_id = ?').get(projectId) as any;
  if (expenses.c > 0) deps.push(`${expenses.c} dépense(s)`);
  const treasury = db.prepare('SELECT COUNT(*) c FROM treasury_transactions WHERE project_id = ?').get(projectId) as any;
  if (treasury.c > 0) deps.push(`${treasury.c} mouvement(s) de trésorerie`);
  const stock = db.prepare('SELECT COUNT(*) c FROM stock_movements WHERE project_id = ?').get(projectId) as any;
  if (stock.c > 0) deps.push(`${stock.c} mouvement(s) de stock`);
  return deps;
}

export function vehicleDependencies(vehicleId: number): string[] {
  const db = getDb();
  const deps: string[] = [];
  const fuel = db.prepare('SELECT COUNT(*) c FROM fuel_entries WHERE vehicle_id = ?').get(vehicleId) as any;
  if (fuel.c > 0) deps.push(`${fuel.c} entrée(s) carburant`);
  const repairs = db.prepare('SELECT COUNT(*) c FROM repair_orders WHERE vehicle_id = ?').get(vehicleId) as any;
  if (repairs.c > 0) deps.push(`${repairs.c} ordre(s) de réparation`);
  return deps;
}

export function workerDependencies(workerId: number): string[] {
  const db = getDb();
  const deps: string[] = [];
  const att = db.prepare('SELECT COUNT(*) c FROM attendance WHERE worker_id = ?').get(workerId) as any;
  if (att.c > 0) deps.push(`${att.c} pointage(s)`);
  const pay = db.prepare('SELECT COUNT(*) c FROM payslips WHERE worker_id = ?').get(workerId) as any;
  if (pay.c > 0) deps.push(`${pay.c} bulletin(s) de paie`);
  const assign = db.prepare('SELECT COUNT(*) c FROM project_assignments WHERE worker_id = ?').get(workerId) as any;
  if (assign.c > 0) deps.push(`${assign.c} affectation(s)`);
  return deps;
}

export function materialDependencies(materialId: number): string[] {
  const db = getDb();
  const deps: string[] = [];
  const mov = db.prepare('SELECT COUNT(*) c FROM stock_movements WHERE material_id = ?').get(materialId) as any;
  if (mov.c > 0) deps.push(`${mov.c} mouvement(s) de stock`);
  return deps;
}

export function isReviewDue(due: string | null): boolean {
  if (!due) return false;
  return new Date().toISOString().slice(0, 19).replace('T', ' ') >= due;
}

export function archiveEntity(table: string, id: number, userId: number, reason: string): void {
  const db = getDb();
  const now = nowIso();
  const due = addDays(now, 365);
  db.prepare(`UPDATE ${table} SET lifecycle_status='archived', archived_at=?, archived_by=?, archive_reason=?, updated_at=?, retention_review_due_at=?, retention_status='scheduled', retention_reviewed_at=NULL, retention_reviewed_by=NULL WHERE id=?`)
    .run(now, userId, reason, now, due, id);
}

export function restoreEntity(table: string, id: number): void {
  const db = getDb();
  db.prepare(`UPDATE ${table} SET lifecycle_status='active', archived_at=NULL, archived_by=NULL, archive_reason='', updated_at=?, retention_review_due_at=NULL, retention_reviewed_at=NULL, retention_reviewed_by=NULL, retention_status='none' WHERE id=?`)
    .run(nowIso(), id);
}

export function markReviewed(table: string, id: number, userId: number): void {
  const db = getDb();
  db.prepare(`UPDATE ${table} SET retention_status='reviewed', retention_reviewed_at=?, retention_reviewed_by=?, updated_at=? WHERE id=?`)
    .run(nowIso(), userId, nowIso(), id);
}


export const LIFECYCLE_TABLES = [
  'clients','suppliers','workers','projects','vehicles','materials','services',
  'commercial_documents','purchases','expenses','treasury_transactions','tools','contracts',
  'users','attendance','repair_orders','stock_movements','fuel_entries','payments','documents'
];

export function syncRetentionNotifications(): number {
  const db = getDb();
  let created = 0;
  for (const t of LIFECYCLE_TABLES) {
    let rows: any[] = [];
    try {
      rows = db.prepare(
        `SELECT id FROM ${t} WHERE lifecycle_status='archived' AND retention_status IN ('scheduled','due') AND retention_review_due_at IS NOT NULL AND retention_review_due_at <= datetime('now')`
      ).all() as any[];
    } catch {
      continue;
    }
    for (const r of rows) {
      const key = `retention_review:${t}:${r.id}`;
      const exists = db.prepare('SELECT id FROM notifications WHERE dedupe_key = ?').get(key);
      if (!exists) {
        db.prepare(
          `INSERT INTO notifications (dedupe_key, type, title, body, entity_type, entity_id) VALUES (?,?,?,?,?,?)`
        ).run(key, 'retention_review', 'Revue annuelle due', `L'enregistrement ${t} #${r.id} est arrive a echeance de revue annuelle.`, t, r.id);
        created++;
      }
      db.prepare(`UPDATE ${t} SET retention_status='due' WHERE id=? AND retention_status='scheduled'`).run(r.id);
    }
  }
  return created;
}

export function listLifecycleRecords(): any[] {
  const db = getDb();
  const out: any[] = [];
  for (const t of LIFECYCLE_TABLES) {
    let rows: any[] = [];
    try {
      rows = db.prepare(`SELECT * FROM ${t}`).all() as any[];
    } catch {
      continue;
    }
    for (const r of rows) {
      const label =
        r.name || r.title || r.full_name || r.project_number || r.doc_number || r.code || `#${r.id}`;
      out.push({
        id: r.id,
        table: t,
        type: t,
        label,
        lifecycle_status: r.lifecycle_status || 'active',
        created_at: r.created_at || null,
        updated_at: r.updated_at || null,
        archived_at: r.archived_at || null,
        deletion_eligible_until: r.deletion_eligible_until || null,
        retention_review_due_at: r.retention_review_due_at || null,
        retention_status: r.retention_status || 'none',
      });
    }
  }
  return out;
}
