import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import * as XLSX from 'xlsx';
import {
  AuthedRequest,
  createSessionToken,
  getPermissionsForRole,
  hashPassword,
  logAudit,
  requireAuth,
  requirePermission,
  UserRole,
  verifyPassword,
} from './auth.ts';
import {
  amountToFrenchWords,
  calculateAlgerianIRG,
  calculateProjectFinancials,
  generateNextNumber,
  getTaxConfigFromDb,
  getTaxRate,
  round2,
} from './calculations.ts';
import { createFullBackup, getBackupHealth, listBackups, restoreFromZip, saveBackupSettings, verifyBackupArchive } from './backup.ts';
import { DOCS_DIR, getDb } from './db.ts';
import { archiveEntity, clientDependencies, isDeletionEligible, projectDependencies, restoreEntity, vehicleDependencies, workerDependencies, materialDependencies, markReviewed, isReviewDue, listLifecycleRecords, syncRetentionNotifications } from './lifecycle.ts';

const router = express.Router();

const loginFailures = new Map<string, { count: number; windowStartedAt: number; lockedUntil: number }>();
const LOGIN_FAILURE_LIMIT = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;

const uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

function sendXlsx(res: express.Response, filename: string, sheets: Array<{ name: string; rows: any[] }>) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows.length > 0 ? sheet.rows : [{ Info: 'Aucune donnée' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31));
  }
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}

// ==================== FIRST-RUN SETUP & AUTHENTICATION ====================
router.get('/auth/setup-status', (_req, res) => {
  const count = (getDb().prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
  res.json({ setupRequired: count === 0 });
});

router.post('/auth/setup', (req, res) => {
  const b = req.body || {};
  const companyName = String(b.companyName || '').trim();
  const legalForm = String(b.legalForm || 'Entreprise individuelle').trim();
  const fullName = String(b.fullName || '').trim();
  const username = String(b.username || '').trim();
  const password = String(b.password || '');
  if (!companyName || !fullName || !username || !password) {
    res.status(400).json({ error: 'Veuillez renseigner le nom de l’entreprise, votre nom, un identifiant et un mot de passe.' });
    return;
  }
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
    res.status(400).json({ error: 'L’identifiant doit contenir 3 à 32 caractères (lettres, chiffres, point, tiret ou underscore).' });
    return;
  }
  if (password.length < 10) {
    res.status(400).json({ error: 'Le mot de passe doit contenir au moins 10 caractères.' });
    return;
  }
  const db = getDb();
  try {
    const createOwner = db.transaction(() => {
      const count = (db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count;
      if (count !== 0) throw new Error('SETUP_ALREADY_COMPLETED');
      db.prepare("INSERT INTO company_settings (id, name, legal_form, currency, language, setup_completed) VALUES (1, ?, ?, 'DZD', 'fr', 1)").run(companyName, legalForm);
      const info = db.prepare("INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')").run(fullName, username, hashPassword(password));
      return Number(info.lastInsertRowid);
    });
    const userId = createOwner.immediate();
    const user = { id: userId, name: fullName, username, role: 'admin' as UserRole, status: 'active' };
    res.status(201).json({ token: createSessionToken(user), user, permissions: getPermissionsForRole('admin') });
  } catch (error: any) {
    if (error?.message === 'SETUP_ALREADY_COMPLETED') {
      res.status(409).json({ error: 'La configuration initiale est déjà terminée. Connectez-vous.' });
      return;
    }
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Cet identifiant existe déjà.' });
      return;
    }
    res.status(500).json({ error: 'Impossible de terminer la configuration initiale.' });
  }
});

router.post('/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!username || !password) {
    res.status(400).json({ error: 'Veuillez saisir votre nom d’utilisateur et mot de passe.' });
    return;
  }

  const key = `${String(req.ip || 'local').slice(0, 80)}:${username.toLowerCase().slice(0, 80)}`;
  const now = Date.now();
  const previous = loginFailures.get(key);
  if (previous?.lockedUntil && previous.lockedUntil > now) {
    const waitSeconds = Math.ceil((previous.lockedUntil - now) / 1000);
    res.setHeader('Retry-After', String(waitSeconds));
    res.status(429).json({ error: `Trop de tentatives. Réessayez dans ${Math.ceil(waitSeconds / 60)} minute(s).` });
    return;
  }
  if (previous && now - previous.windowStartedAt > LOGIN_WINDOW_MS) loginFailures.delete(key);

  const db = getDb();
  const userRow = db
    .prepare('SELECT id, name, username, password_hash, role, status FROM users WHERE username = ?')
    .get(username) as
    | { id: number; name: string; username: string; password_hash: string; role: UserRole; status: string }
    | undefined;

  if (!userRow || !verifyPassword(password, userRow.password_hash)) {
    const current = loginFailures.get(key);
    const entry = current && now - current.windowStartedAt <= LOGIN_WINDOW_MS
      ? current
      : { count: 0, windowStartedAt: now, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= LOGIN_FAILURE_LIMIT) entry.lockedUntil = now + LOGIN_LOCK_MS;
    loginFailures.set(key, entry);
    res.status(entry.lockedUntil > now ? 429 : 401).json({
      error: entry.lockedUntil > now
        ? 'Trop de tentatives. Le compte est temporairement protégé pendant 15 minutes.'
        : 'Identifiants incorrects. Vérifiez votre nom d’utilisateur et mot de passe.',
    });
    return;
  }
  if (userRow.status !== 'active') {
    res.status(403).json({ error: 'Ce compte utilisateur est désactivé. Contactez l’administrateur.' });
    return;
  }

  loginFailures.delete(key);
  db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(userRow.id);
  const user = {
    id: userRow.id,
    name: userRow.name,
    username: userRow.username,
    role: userRow.role,
    status: userRow.status,
  };
  const token = createSessionToken(user);
  logAudit(user, 'LOGIN', 'session', user.id, '', 'Connexion au poste local');
  res.json({ token, user, permissions: getPermissionsForRole(user.role) });
});

router.post('/auth/logout', requireAuth, (req: AuthedRequest, res) => {
  if (req.user) logAudit(req.user, 'LOGOUT', 'session', req.user.id, '', 'Déconnexion');
  res.json({ ok: true });
});

router.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
  res.json({ user: req.user, permissions: getPermissionsForRole(req.user!.role) });
});

// ==================== DASHBOARD ====================
router.get('/dashboard', requireAuth, requirePermission('dashboard:view'), (req: AuthedRequest, res) => {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7); // YYYY-MM (or latest active month in seed if needed)

  const activeProjectsCount = (
    db.prepare("SELECT COUNT(*) AS c FROM projects WHERE status = 'in_progress'").get() as { c: number }
  ).c;
  const lateProjectsCount = (
    db
      .prepare(
        `SELECT COUNT(DISTINCT p.id) AS c
         FROM projects p
         LEFT JOIN project_tasks t ON t.project_id = p.id
         WHERE p.status = 'in_progress' AND (p.expected_end_date < ? OR t.status = 'delayed')`
      )
      .get(today) as { c: number }
  ).c;

  // Present today or most recent attendance date
  const latestAttDateRow = db
    .prepare('SELECT MAX(attendance_date) AS d FROM attendance')
    .get() as { d?: string };
  const refDate = latestAttDateRow?.d || today;
  const workersPresentToday = (
    db
      .prepare(
        "SELECT COUNT(DISTINCT worker_id) AS c FROM attendance WHERE attendance_date = ? AND status IN ('present','half_day')"
      )
      .get(refDate) as { c: number }
  ).c;
  const workersOnLeave = (
    db.prepare("SELECT COUNT(*) AS c FROM workers WHERE status = 'on_leave'").get() as { c: number }
  ).c;

  const lowStock = db
    .prepare(
      `SELECT m.*, s.name AS supplier_name
       FROM materials m
       LEFT JOIN suppliers s ON s.id = m.preferred_supplier_id
       WHERE m.status = 'active' AND m.current_quantity <= m.min_stock_level
       ORDER BY (m.current_quantity - m.min_stock_level) ASC`
    )
    .all() as any[];

  const vehiclesMaint = (
    db
      .prepare("SELECT COUNT(*) AS c FROM vehicles WHERE status IN ('under_maintenance','broken_down')")
      .get() as { c: number }
  ).c;

  const unpaidInvoices = db
    .prepare(
      `SELECT d.*, c.name AS client_name
       FROM commercial_documents d
       JOIN clients c ON c.id = d.client_id
       WHERE d.doc_type = 'facture' AND d.status IN ('issued','partial','overdue')
       ORDER BY d.due_date ASC`
    )
    .all() as any[];

  // Active projects with real costs
  const activeProjectsRaw = db
    .prepare(
      `SELECT p.*, c.name AS client_name
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       WHERE p.status IN ('in_progress','waiting_approval')
       ORDER BY p.id ASC`
    )
    .all() as any[];

  const activeProjects = activeProjectsRaw.map((p) => {
    const fin = calculateProjectFinancials(p.id);
    return {
      ...p,
      real_cost: fin.total_actual_cost,
      revised_budget: fin.revised_budget_cost,
      budget_variance: fin.budget_variance,
      invoiced_ht: fin.invoiced_ht,
      net_profit: fin.net_profit,
    };
  });

  // Treasury balances (Bank & Cash) excluding internal transfers from revenue/expense
  const cashRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tx_type = 'cash_inflow' THEN amount
                           WHEN tx_type = 'internal_transfer' AND to_account = 'Caisse' THEN amount
                           WHEN tx_type = 'cash_outflow' OR tx_type = 'advance' THEN -amount
                           WHEN tx_type = 'internal_transfer' AND account = 'Caisse' THEN -amount
                           ELSE 0 END), 0) AS bal
       FROM treasury_transactions`
    )
    .get() as { bal: number };

  const bankRow = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN tx_type = 'bank_inflow' THEN amount
                           WHEN tx_type = 'internal_transfer' AND to_account = 'Banque' THEN amount
                           WHEN tx_type = 'bank_outflow' THEN -amount
                           WHEN tx_type = 'internal_transfer' AND account = 'Banque' THEN -amount
                           ELSE 0 END), 0) AS bal
       FROM treasury_transactions`
    )
    .get() as { bal: number };

  // Monthly revenue (invoiced HT excluding draft/cancelled, latest active month or current month)
  const revRow = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN doc_type='facture' THEN total_ht WHEN doc_type='avoir' THEN -total_ht ELSE 0 END), 0) AS total
       FROM commercial_documents
       WHERE status NOT IN ('draft','cancelled')`
    )
    .get() as { total: number };

  const expRow = db
    .prepare(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE status <> 'cancelled') +
        (SELECT COALESCE(SUM(total_cost), 0) FROM stock_movements WHERE movement_type = 'exit') +
        (SELECT COALESCE(SUM(total_cost), 0) FROM fuel_entries) +
        (SELECT COALESCE(SUM(total_cost), 0) FROM repair_orders) AS total`
    )
    .get() as { total: number };

  const receivables = unpaidInvoices.reduce((s, d) => s + Math.max(0, d.total_ttc - d.amount_paid), 0);
  const payablesRow = db
    .prepare(
      `SELECT COALESCE(SUM(total_ttc - amount_paid), 0) AS total
       FROM purchases WHERE status NOT IN ('paid','cancelled')`
    )
    .get() as { total: number };

  const pendingAttendance = (
    db.prepare("SELECT COUNT(*) AS c FROM attendance WHERE approval_status = 'pending'").get() as { c: number }
  ).c;

  // Preventive maintenance / document expiries alerts
  const alerts: Array<{ level: 'danger' | 'warning' | 'info'; title: string; target: string }> = [];
  if (lowStock.length > 0) {
    alerts.push({
      level: 'warning',
      title: `${lowStock.length} matériau(x) sous le seuil de stock minimum (${lowStock[0].name})`,
      target: 'materials',
    });
  }
  const overdueInvoices = unpaidInvoices.filter((i) => i.status === 'overdue' || (i.due_date && i.due_date < refDate));
  if (overdueInvoices.length > 0) {
    alerts.push({
      level: 'danger',
      title: `${overdueInvoices.length} facture(s) en retard d’échéance`,
      target: 'invoices',
    });
  }
  if (pendingAttendance > 0) {
    alerts.push({
      level: 'info',
      title: `${pendingAttendance} ligne(s) de pointage en attente de validation Admin`,
      target: 'attendance',
    });
  }

  const maintAlerts = db
    .prepare(
      `SELECT mr.rule_name, v.name AS vehicle_name, v.current_mileage, v.current_engine_hours, mr.trigger_type, mr.next_due_value
       FROM maintenance_rules mr
       JOIN vehicles v ON v.id = mr.vehicle_id
       WHERE mr.active = 1`
    )
    .all() as any[];
  for (const m of maintAlerts) {
    const val = m.trigger_type === 'km' ? m.current_mileage : m.current_engine_hours;
    if (m.next_due_value > 0 && val >= m.next_due_value * 0.96) {
      alerts.push({
        level: 'warning',
        title: `Maintenance proche : ${m.vehicle_name} — ${m.rule_name}`,
        target: 'maintenance',
      });
    }
  }

  const lastBackup = db.prepare('SELECT created_at, file_name FROM backup_history ORDER BY id DESC LIMIT 1').get() as any;
  const backupHealth = getBackupHealth();
  const recentLogs = db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 8').all();
  const canSeeFinance = ['admin', 'accountant'].includes(req.user!.role);

  res.json({
    canSeeFinance,
    refDate,
    monthPrefix,
    kpis: {
      activeProjects: activeProjectsCount,
      lateProjects: lateProjectsCount,
      workersPresentToday,
      workersOnLeave,
      lowStockCount: lowStock.length,
      vehiclesMaintenance: vehiclesMaint,
      unpaidInvoicesCount: unpaidInvoices.length,
      totalRevenueHt: canSeeFinance ? round2(revRow.total) : null,
      totalCosts: canSeeFinance ? round2(expRow.total) : null,
      netResult: canSeeFinance ? round2(revRow.total - expRow.total) : null,
      cashBalance: canSeeFinance ? round2(cashRow.bal) : null,
      bankBalance: canSeeFinance ? round2(bankRow.bal) : null,
      receivables: canSeeFinance ? round2(receivables) : null,
      payables: canSeeFinance ? round2(payablesRow.total) : null,
      pendingAttendance,
      lastBackupAt: lastBackup?.created_at || null,
    },
    backupHealth,
    alerts,
    activeProjects,
    unpaidInvoices: canSeeFinance ? unpaidInvoices : [],
    lowStock,
    recentLogs,
  });
});

// ==================== CLIENTS ====================
router.get('/clients', requireAuth, requirePermission('clients:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT c.*,
        (SELECT COUNT(*) FROM projects p WHERE p.client_id = c.id) AS project_count,
        (SELECT COALESCE(SUM(MAX(0, d.total_ttc - d.amount_paid -
          COALESCE((SELECT SUM(a.total_ttc) FROM commercial_documents a
                    WHERE a.doc_type='avoir' AND a.linked_doc_id=d.id
                      AND a.status NOT IN ('draft','cancelled')), 0))), 0)
         FROM commercial_documents d
         WHERE d.client_id = c.id AND d.doc_type='facture' AND d.status NOT IN ('draft','cancelled')) AS balance_due
       FROM clients c ORDER BY c.id DESC`
    )
    .all();
  res.json(rows);
});

router.get('/clients/export/xlsx', requireAuth, requirePermission('clients:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id AS ID, client_type AS Type, name AS Nom, phone AS Téléphone, email AS Email, address AS Adresse, nif AS NIF, nis AS NIS, rc AS RC, ai AS AI, status AS Statut FROM clients ORDER BY id DESC')
    .all();
  sendXlsx(res, 'clients_gestionpro_dz.xlsx', [{ name: 'Clients', rows }]);
});

router.get('/clients/:id', requireAuth, requirePermission('clients:read'), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  if (!client) {
    res.status(404).json({ error: 'Client introuvable.' });
    return;
  }
  const projects = db.prepare('SELECT * FROM projects WHERE client_id = ? ORDER BY id DESC').all(id);
  const documents = db
    .prepare('SELECT * FROM commercial_documents WHERE client_id = ? ORDER BY issue_date DESC, id DESC')
    .all(id);
  const payments = db
    .prepare("SELECT * FROM payments WHERE client_id = ? AND direction = 'inflow' ORDER BY payment_date DESC, id DESC")
    .all(id);
  const totalInvoiced = documents
    .filter((d: any) => d.doc_type === 'facture' && !['draft', 'cancelled'].includes(d.status))
    .reduce((s: number, d: any) => s + Number(d.total_ttc || 0), 0);
  const totalCredits = documents
    .filter((d: any) => d.doc_type === 'avoir' && !['draft', 'cancelled'].includes(d.status))
    .reduce((s: number, d: any) => s + Number(d.total_ttc || 0), 0);
  const totalPaid = payments.reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
  res.json({
    client,
    projects,
    documents,
    payments,
    totals: {
      totalInvoiced: round2(totalInvoiced),
      totalCredits: round2(totalCredits),
      totalPaid: round2(totalPaid),
      balanceDue: round2(Math.max(0, totalInvoiced - totalCredits - totalPaid)),
    },
  });
});

router.post('/clients', requireAuth, requirePermission('clients:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.name?.trim()) {
    res.status(400).json({ error: 'Le nom ou la raison sociale du client est obligatoire.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO clients (client_type, name, phone, email, address, nif, nis, rc, ai, payment_terms, credit_limit, notes, status, lifecycle_status, deletion_eligible_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', '+7 days'))`
    )
    .run(
      b.client_type === 'individual' ? 'individual' : 'company',
      b.name.trim(),
      b.phone || '',
      b.email || '',
      b.address || '',
      b.nif || '',
      b.nis || '',
      b.rc || '',
      b.ai || '',
      b.payment_terms || 'Virement',
      Number(b.credit_limit || 0),
      b.notes || '',
      b.status || 'active'
    );
  const created = db.prepare('SELECT * FROM clients WHERE id = ?').get(info.lastInsertRowid);
  logAudit(req.user!, 'CREATE', 'client', info.lastInsertRowid, '', b.name.trim());
  res.status(201).json(created);
});

router.put('/clients/:id', requireAuth, requirePermission('clients:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Client introuvable.' });
    return;
  }
  db.prepare(
    `UPDATE clients SET client_type=?, name=?, phone=?, email=?, address=?, nif=?, nis=?, rc=?, ai=?, payment_terms=?, credit_limit=?, notes=?, status=? WHERE id=?`
  ).run(
    b.client_type || old.client_type,
    b.name ?? old.name,
    b.phone ?? old.phone,
    b.email ?? old.email,
    b.address ?? old.address,
    b.nif ?? old.nif,
    b.nis ?? old.nis,
    b.rc ?? old.rc,
    b.ai ?? old.ai,
    b.payment_terms ?? old.payment_terms,
    b.credit_limit !== undefined ? Number(b.credit_limit) : old.credit_limit,
    b.notes ?? old.notes,
    b.status ?? old.status,
    id
  );
  logAudit(req.user!, 'UPDATE', 'client', id, old.name, b.name ?? old.name);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(id));
});

router.delete('/clients/:id', requireAuth, requirePermission('clients:delete'), requirePermission('lifecycle:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Client introuvable.' }); return; }
  const deps = clientDependencies(id);
  if (deps.length > 0) {
    res.status(400).json({ error: `Suppression impossible : ${deps.join(', ')}.`, dependencies: deps });
    return;
  }
  const deadline = row.deletion_eligible_until || row.created_at;
  if (!isDeletionEligible(deadline)) {
    res.status(400).json({ error: 'Suppression impossible : la période de 7 jours est dépassée. Archivez le client à la place.' });
    return;
  }
  db.prepare('DELETE FROM clients WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'client', id, '', 'Suppression client (période 7 jours)');
  res.json({ ok: true });
});

router.post('/clients/:id/archive', requireAuth, requirePermission('clients:write'), requirePermission('lifecycle:archive'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Client introuvable.' }); return; }
  archiveEntity('clients', id, req.user!.id, (req.body?.reason || 'Archivage manuel'));
  logAudit(req.user!, 'ARCHIVE', 'client', id, row.status, 'Archivé');
  res.json({ ok: true });
});

router.post('/clients/:id/restore', requireAuth, requirePermission('clients:write'), requirePermission('lifecycle:restore'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM clients WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Client introuvable.' }); return; }
  restoreEntity('clients', id);
  logAudit(req.user!, 'RESTORE', 'client', id, 'archived', 'Restauré');
  res.json({ ok: true });
});

// ==================== PROJECTS / CHANTIERS ====================
router.get('/projects', requireAuth, requirePermission('projects:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS client_name, u.name AS manager_name
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN users u ON u.id = p.manager_user_id
       ORDER BY p.id DESC`
    )
    .all() as any[];

  const enriched = rows.map((p) => {
    const fin = calculateProjectFinancials(p.id);
    return { ...p, financials: fin };
  });
  res.json(enriched);
});

router.get('/projects/:id', requireAuth, requirePermission('projects:read'), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const project = db
    .prepare(
      `SELECT p.*, c.name AS client_name, c.phone AS client_phone, u.name AS manager_name
       FROM projects p
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN users u ON u.id = p.manager_user_id
       WHERE p.id = ?`
    )
    .get(id);
  if (!project) {
    res.status(404).json({ error: 'Chantier introuvable.' });
    return;
  }
  const financials = calculateProjectFinancials(id);
  const phases = db.prepare('SELECT * FROM project_phases WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(id);
  const tasks = db
    .prepare(
      `SELECT t.*, w.full_name AS worker_name
       FROM project_tasks t
       LEFT JOIN workers w ON w.id = t.assigned_worker_id
       WHERE t.project_id = ? ORDER BY t.id ASC`
    )
    .all(id);
  const taskDependencies = db
    .prepare('SELECT * FROM project_task_dependencies WHERE project_id = ? ORDER BY id ASC')
    .all(id);
  const changeOrders = db.prepare('SELECT * FROM change_orders WHERE project_id = ? ORDER BY id DESC').all(id);
  const contracts = db.prepare('SELECT * FROM contracts WHERE project_id = ? ORDER BY id DESC').all(id) as any[];
  for (const ctr of contracts) {
    ctr.milestones = db.prepare('SELECT * FROM contract_milestones WHERE contract_id = ? ORDER BY due_date ASC').all(ctr.id);
  }
  const stockMovements = db
    .prepare(
      `SELECT sm.*, m.name AS material_name, m.unit
       FROM stock_movements sm
       JOIN materials m ON m.id = sm.material_id
       WHERE sm.project_id = ? ORDER BY sm.movement_date DESC, sm.id DESC`
    )
    .all(id);
  const invoices = db.prepare('SELECT * FROM commercial_documents WHERE project_id = ? ORDER BY issue_date DESC').all(id);
  const expenses = db.prepare('SELECT * FROM expenses WHERE project_id = ? ORDER BY expense_date DESC').all(id);
  const fuel = db
    .prepare(
      `SELECT f.*, v.name AS vehicle_name FROM fuel_entries f JOIN vehicles v ON v.id = f.vehicle_id WHERE f.project_id = ? ORDER BY f.date DESC`
    )
    .all(id);

  res.json({
    project,
    financials,
    phases,
    tasks,
    taskDependencies,
    changeOrders,
    contracts,
    stockMovements,
    invoices,
    expenses,
    fuel,
  });
});

router.post('/projects', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.title?.trim() || !b.client_id) {
    res.status(400).json({ error: 'Le titre du chantier et le client sont obligatoires.' });
    return;
  }
  const db = getDb();
  const settings = db.prepare('SELECT prefix_project FROM company_settings WHERE id = 1').get() as { prefix_project: string };
  let projectNumber = b.project_number?.trim() || '';

  const info = db
    .transaction(() => {
      if (!projectNumber) {
        projectNumber = generateNextNumber(settings?.prefix_project || 'CH', 'projects', 'project_number');
      }
      return db
        .prepare(
          `INSERT INTO projects (project_number, client_id, title, address, project_type, start_date, expected_end_date, status, manager_user_id, expected_cost, expected_selling_price, progress_percent, include_overhead, notes, lifecycle_status, deletion_eligible_until)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', '+7 days'))`
        )
        .run(
          projectNumber,
          Number(b.client_id),
          b.title.trim(),
          b.address || '',
          b.project_type || 'Travaux généraux BTP',
          b.start_date || new Date().toISOString().slice(0, 10),
          b.expected_end_date || null,
          b.status || 'in_progress',
          b.manager_user_id ? Number(b.manager_user_id) : req.user!.id,
          Number(b.expected_cost || 0),
          Number(b.expected_selling_price || 0),
          Number(b.progress_percent || 0),
          b.include_overhead ? 1 : 0,
          b.notes || ''
        );
    })
    .immediate();
  logAudit(req.user!, 'CREATE', 'project', projectNumber, '', b.title.trim());
  res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/projects/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Chantier introuvable.' });
    return;
  }
  db.prepare(
    `UPDATE projects SET client_id=?, title=?, address=?, project_type=?, start_date=?, expected_end_date=?, actual_end_date=?, status=?, expected_cost=?, expected_selling_price=?, progress_percent=?, include_overhead=?, notes=? WHERE id=?`
  ).run(
    b.client_id ? Number(b.client_id) : old.client_id,
    b.title ?? old.title,
    b.address ?? old.address,
    b.project_type ?? old.project_type,
    b.start_date ?? old.start_date,
    b.expected_end_date !== undefined ? b.expected_end_date : old.expected_end_date,
    b.actual_end_date !== undefined ? b.actual_end_date : old.actual_end_date,
    b.status ?? old.status,
    b.expected_cost !== undefined ? Number(b.expected_cost) : old.expected_cost,
    b.expected_selling_price !== undefined ? Number(b.expected_selling_price) : old.expected_selling_price,
    b.progress_percent !== undefined ? Number(b.progress_percent) : old.progress_percent,
    b.include_overhead !== undefined ? (b.include_overhead ? 1 : 0) : old.include_overhead,
    b.notes ?? old.notes,
    id
  );
  logAudit(req.user!, 'UPDATE', 'project', old.project_number, old.status, b.status ?? old.status);
  res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
});

router.delete('/projects/:id', requireAuth, requirePermission('projects:write'), requirePermission('lifecycle:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Chantier introuvable.' }); return; }
  const deps = projectDependencies(id);
  if (deps.length > 0) {
    res.status(400).json({ error: `Suppression impossible : ${deps.join(', ')}.`, dependencies: deps });
    return;
  }
  const deadline = row.deletion_eligible_until || row.created_at;
  if (!isDeletionEligible(deadline)) {
    res.status(400).json({ error: 'Suppression impossible : la période de 7 jours est dépassée. Archivez le chantier à la place.' });
    return;
  }
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'project', row.project_number, '', 'Suppression chantier (période 7 jours)');
  res.json({ ok: true });
});

router.post('/projects/:id/archive', requireAuth, requirePermission('projects:write'), requirePermission('lifecycle:archive'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Chantier introuvable.' }); return; }
  archiveEntity('projects', id, req.user!.id, (req.body?.reason || 'Archivage manuel'));
  logAudit(req.user!, 'ARCHIVE', 'project', row.project_number, row.status, 'Archivé');
  res.json({ ok: true });
});

router.post('/projects/:id/restore', requireAuth, requirePermission('projects:write'), requirePermission('lifecycle:restore'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Chantier introuvable.' }); return; }
  restoreEntity('projects', id);
  logAudit(req.user!, 'RESTORE', 'project', row.project_number, 'archived', 'Restauré');
  res.json({ ok: true });
});

router.post('/projects/:id/cancel', requireAuth, requirePermission('projects:write'), requirePermission('lifecycle:cancel'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Chantier introuvable.' }); return; }
  if (row.status === 'cancelled') { res.status(400).json({ error: 'Ce chantier est déjà annulé.' }); return; }
  if (row.status === 'completed') { res.status(400).json({ error: 'Un chantier terminé ne peut pas être annulé.' }); return; }
  const inv = (db.prepare("SELECT COUNT(*) c FROM commercial_documents WHERE project_id = ? AND status NOT IN ('draft','cancelled')").get(id) as any).c;
  if (inv > 0) { res.status(400).json({ error: 'Annulation impossible : des pièces commerciales sont liées à ce chantier.' }); return; }
  const exp = (db.prepare('SELECT COUNT(*) c FROM expenses WHERE project_id = ?').get(id) as any).c;
  if (exp > 0) { res.status(400).json({ error: 'Annulation impossible : des dépenses sont liées à ce chantier.' }); return; }
  const stock = (db.prepare('SELECT COUNT(*) c FROM stock_movements WHERE project_id = ?').get(id) as any).c;
  if (stock > 0) { res.status(400).json({ error: 'Annulation impossible : des mouvements de stock sont liés à ce chantier.' }); return; }
  db.prepare("UPDATE projects SET status='cancelled', updated_at=? WHERE id=?").run(new Date().toISOString().slice(0,19).replace('T',' '), id);
  logAudit(req.user!, 'CANCEL', 'project', row.project_number, row.status, 'cancelled');
  res.json({ ok: true, status: 'cancelled' });
});

// --- VEHICLES ---
router.delete('/vehicles/:id', requireAuth, requirePermission('vehicles:write'), requirePermission('lifecycle:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Véhicule introuvable.' }); return; }
  const deps = vehicleDependencies(id);
  if (deps.length > 0) { res.status(400).json({ error: `Suppression impossible : ${deps.join(', ')}.`, dependencies: deps }); return; }
  const deadline = row.deletion_eligible_until || row.created_at;
  if (!isDeletionEligible(deadline)) { res.status(400).json({ error: 'Suppression impossible : la période de 7 jours est dépassée. Archivez le véhicule à la place.' }); return; }
  db.prepare('DELETE FROM vehicles WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'vehicle', id, '', 'Suppression véhicule (période 7 jours)');
  res.json({ ok: true });
});
router.post('/vehicles/:id/archive', requireAuth, requirePermission('vehicles:write'), requirePermission('lifecycle:archive'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Véhicule introuvable.' }); return; }
  archiveEntity('vehicles', id, req.user!.id, (req.body?.reason || 'Archivage manuel'));
  logAudit(req.user!, 'ARCHIVE', 'vehicle', id, row.status, 'Archivé');
  res.json({ ok: true });
});
router.post('/vehicles/:id/restore', requireAuth, requirePermission('vehicles:write'), requirePermission('lifecycle:restore'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Véhicule introuvable.' }); return; }
  restoreEntity('vehicles', id);
  logAudit(req.user!, 'RESTORE', 'vehicle', id, 'archived', 'Restauré');
  res.json({ ok: true });
});

// --- WORKERS ---
router.delete('/workers/:id', requireAuth, requirePermission('payroll:write'), requirePermission('lifecycle:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Employé introuvable.' }); return; }
  const deps = workerDependencies(id);
  if (deps.length > 0) { res.status(400).json({ error: `Suppression impossible : ${deps.join(', ')}.`, dependencies: deps }); return; }
  const deadline = row.deletion_eligible_until || row.created_at;
  if (!isDeletionEligible(deadline)) { res.status(400).json({ error: 'Suppression impossible : la période de 7 jours est dépassée. Archivez l’employé à la place.' }); return; }
  db.prepare('DELETE FROM workers WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'worker', id, '', 'Suppression employé (période 7 jours)');
  res.json({ ok: true });
});
router.post('/workers/:id/archive', requireAuth, requirePermission('payroll:write'), requirePermission('lifecycle:archive'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Employé introuvable.' }); return; }
  archiveEntity('workers', id, req.user!.id, (req.body?.reason || 'Archivage manuel'));
  logAudit(req.user!, 'ARCHIVE', 'worker', id, row.status, 'Archivé');
  res.json({ ok: true });
});
router.post('/workers/:id/restore', requireAuth, requirePermission('payroll:write'), requirePermission('lifecycle:restore'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Employé introuvable.' }); return; }
  restoreEntity('workers', id);
  logAudit(req.user!, 'RESTORE', 'worker', id, 'archived', 'Restauré');
  res.json({ ok: true });
});

// --- SUPPLIERS ---
router.delete('/suppliers/:id', requireAuth, requirePermission('suppliers:write'), requirePermission('lifecycle:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Fournisseur introuvable.' }); return; }
  // deps: purchases
  const purchases = (db.prepare('SELECT COUNT(*) c FROM purchases WHERE supplier_id = ?').get(id) as any).c;
  if (purchases > 0) { res.status(400).json({ error: `Suppression impossible : ${purchases} achat(s).`, dependencies: [`${purchases} achat(s)`] }); return; }
  const deadline = row.deletion_eligible_until || row.created_at;
  if (!isDeletionEligible(deadline)) { res.status(400).json({ error: 'Suppression impossible : la période de 7 jours est dépassée. Archivez le fournisseur à la place.' }); return; }
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'supplier', id, '', 'Suppression fournisseur (période 7 jours)');
  res.json({ ok: true });
});
router.post('/suppliers/:id/archive', requireAuth, requirePermission('suppliers:write'), requirePermission('lifecycle:archive'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Fournisseur introuvable.' }); return; }
  archiveEntity('suppliers', id, req.user!.id, (req.body?.reason || 'Archivage manuel'));
  logAudit(req.user!, 'ARCHIVE', 'supplier', id, row.status, 'Archivé');
  res.json({ ok: true });
});
router.post('/suppliers/:id/restore', requireAuth, requirePermission('suppliers:write'), requirePermission('lifecycle:restore'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Fournisseur introuvable.' }); return; }
  restoreEntity('suppliers', id);
  logAudit(req.user!, 'RESTORE', 'supplier', id, 'archived', 'Restauré');
  res.json({ ok: true });
});

// --- MATERIALS ---
router.delete('/materials/:id', requireAuth, requirePermission('materials:write'), requirePermission('lifecycle:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Matériau introuvable.' }); return; }
  const deps = materialDependencies(id);
  if (deps.length > 0) { res.status(400).json({ error: `Suppression impossible : ${deps.join(', ')}.`, dependencies: deps }); return; }
  const deadline = row.deletion_eligible_until || row.created_at;
  if (!isDeletionEligible(deadline)) { res.status(400).json({ error: 'Suppression impossible : la période de 7 jours est dépassée. Archivez le matériau à la place.' }); return; }
  db.prepare('DELETE FROM materials WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'material', id, '', 'Suppression matériau (période 7 jours)');
  res.json({ ok: true });
});
router.post('/materials/:id/archive', requireAuth, requirePermission('materials:write'), requirePermission('lifecycle:archive'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Matériau introuvable.' }); return; }
  archiveEntity('materials', id, req.user!.id, (req.body?.reason || 'Archivage manuel'));
  logAudit(req.user!, 'ARCHIVE', 'material', id, row.status, 'Archivé');
  res.json({ ok: true });
});
router.post('/materials/:id/restore', requireAuth, requirePermission('materials:write'), requirePermission('lifecycle:restore'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Matériau introuvable.' }); return; }
  restoreEntity('materials', id);
  logAudit(req.user!, 'RESTORE', 'material', id, 'archived', 'Restauré');
  res.json({ ok: true });
});

router.post('/projects/:id/phases', requireAuth, requirePermission('projects:write'), (req, res) => {
  const id = Number(req.params.id);
  const { name, sort_order, status } = req.body || {};
  if (!name?.trim()) {
    res.status(400).json({ error: 'Le nom de la phase est obligatoire.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare('INSERT INTO project_phases (project_id, name, sort_order, status) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), Number(sort_order || 1), status || 'planned');
  res.status(201).json(db.prepare('SELECT * FROM project_phases WHERE id = ?').get(info.lastInsertRowid));
});

router.post('/projects/:id/tasks', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  if (!Number.isInteger(id) || id <= 0 || !db.prepare('SELECT id FROM projects WHERE id = ?').get(id)) {
    res.status(404).json({ error: 'Chantier introuvable.' });
    return;
  }
  if (!String(b.title || '').trim()) {
    res.status(400).json({ error: 'Le titre de la tâche est obligatoire.' });
    return;
  }
  const validDate = (value: unknown) => {
    if (value === null || value === undefined || value === '') return true;
    if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false;
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  };
  if (!validDate(b.planned_start) || !validDate(b.due_date) || (b.planned_start && b.due_date && b.planned_start > b.due_date)) {
    res.status(400).json({ error: 'Les dates de planification sont invalides : la date de début doit précéder ou égaler l’échéance.' });
    return;
  }
  const phaseId = b.phase_id ? Number(b.phase_id) : null;
  if (phaseId !== null && (!Number.isInteger(phaseId) || !db.prepare('SELECT id FROM project_phases WHERE id = ? AND project_id = ?').get(phaseId, id))) {
    res.status(400).json({ error: 'La phase sélectionnée ne fait pas partie de ce chantier.' });
    return;
  }
  const workerId = b.assigned_worker_id ? Number(b.assigned_worker_id) : null;
  if (workerId !== null) {
    const worker = db.prepare("SELECT id, status FROM workers WHERE id = ?").get(workerId) as any;
    if (!worker || worker.status === 'terminated' || worker.status === 'suspended') {
      res.status(400).json({ error: 'Le salarié sélectionné est introuvable, sorti ou suspendu.' });
      return;
    }
  }
  const status = b.status || 'planned';
  if (!['planned', 'in_progress', 'delayed', 'completed'].includes(status)) {
    res.status(400).json({ error: 'Statut de tâche invalide.' });
    return;
  }
  if (status === 'delayed' && !String(b.delay_reason || '').trim()) {
    res.status(400).json({ error: 'Veuillez préciser le motif du retard.' });
    return;
  }
  const info = db
    .prepare(
      `INSERT INTO project_tasks (project_id, phase_id, title, assigned_worker_id, planned_start, due_date, status, delay_reason, delay_reported_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      phaseId,
      String(b.title).trim(),
      workerId,
      b.planned_start || null,
      b.due_date || null,
      status,
      b.delay_reason || '',
      status === 'delayed' ? new Date().toISOString().slice(0, 10) : null,
      b.notes || ''
    );
  logAudit(req.user!, 'CREATE', 'project_task', info.lastInsertRowid, '', String(b.title).trim());
  res.status(201).json(db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/projects/tasks/:taskId', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const taskId = Number(req.params.taskId);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId) as any;
  if (!old) {
    res.status(404).json({ error: 'Tâche introuvable.' });
    return;
  }
  if (b.status === 'delayed' && !String(b.delay_reason || old.delay_reason).trim()) {
    res.status(400).json({ error: 'Veuillez préciser le motif du retard.' });
    return;
  }
  const assignedWorkerId = b.assigned_worker_id !== undefined
    ? (b.assigned_worker_id ? Number(b.assigned_worker_id) : null)
    : old.assigned_worker_id;
  if (assignedWorkerId !== null) {
    const worker = db.prepare("SELECT id, status FROM workers WHERE id = ?").get(assignedWorkerId) as any;
    if (!worker || worker.status === 'terminated' || worker.status === 'suspended') {
      res.status(400).json({ error: 'Le salarié sélectionné est introuvable, sorti ou suspendu.' });
      return;
    }
  }
  const taskStatus = b.status ?? old.status;
  if (!['planned', 'in_progress', 'delayed', 'completed'].includes(taskStatus)) {
    res.status(400).json({ error: 'Statut de tâche invalide.' });
    return;
  }
  db.prepare(
    'UPDATE project_tasks SET title=?, phase_id=?, assigned_worker_id=?, planned_start=?, due_date=?, status=?, delay_reason=?, delay_reported_at=?, notes=? WHERE id=?'
  ).run(
    String(b.title ?? old.title).trim(),
    b.phase_id !== undefined ? (b.phase_id ? Number(b.phase_id) : null) : old.phase_id,
    assignedWorkerId,
    b.planned_start !== undefined ? (b.planned_start || null) : old.planned_start,
    b.due_date !== undefined ? (b.due_date || null) : old.due_date,
    taskStatus,
    b.delay_reason ?? old.delay_reason,
    taskStatus === 'delayed' ? b.delay_reported_at || old.delay_reported_at || new Date().toISOString().slice(0, 10) : old.delay_reported_at,
    b.notes ?? old.notes,
    taskId
  );
  logAudit(req.user!, 'UPDATE', 'project_task', taskId, old.status, b.status ?? old.status);
  res.json(db.prepare('SELECT * FROM project_tasks WHERE id = ?').get(taskId));
});

router.post('/projects/:id/task-dependencies', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const projectId = Number(req.params.id);
  const predecessorId = Number(req.body?.predecessor_task_id);
  const successorId = Number(req.body?.successor_task_id);
  const db = getDb();

  if (!Number.isInteger(projectId) || projectId <= 0 || !db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) {
    res.status(404).json({ error: 'Chantier introuvable.' });
    return;
  }
  if (!Number.isInteger(predecessorId) || !Number.isInteger(successorId) || predecessorId <= 0 || successorId <= 0 || predecessorId === successorId) {
    res.status(400).json({ error: 'Sélectionnez deux tâches différentes.' });
    return;
  }
  const tasks = db.prepare('SELECT id FROM project_tasks WHERE project_id = ? AND id IN (?, ?)').all(projectId, predecessorId, successorId) as any[];
  if (tasks.length !== 2) {
    res.status(400).json({ error: 'Les deux tâches doivent appartenir au même chantier.' });
    return;
  }
  const cycle = db.prepare(`
    WITH RECURSIVE reachable(task_id) AS (
      SELECT successor_task_id
      FROM project_task_dependencies
      WHERE predecessor_task_id = ?
      UNION
      SELECT d.successor_task_id
      FROM project_task_dependencies d
      JOIN reachable r ON d.predecessor_task_id = r.task_id
    )
    SELECT 1 AS found FROM reachable WHERE task_id = ? LIMIT 1
  `).get(successorId, predecessorId);
  if (cycle) {
    res.status(409).json({ error: 'Cette dépendance créerait une boucle dans le planning.' });
    return;
  }
  try {
    const info = db.prepare(
      'INSERT INTO project_task_dependencies (project_id, predecessor_task_id, successor_task_id, created_by) VALUES (?, ?, ?, ?)'
    ).run(projectId, predecessorId, successorId, req.user!.id);
    logAudit(req.user!, 'CREATE', 'project_task_dependency', info.lastInsertRowid, '', `${predecessorId} → ${successorId}`);
    res.status(201).json(db.prepare('SELECT * FROM project_task_dependencies WHERE id = ?').get(info.lastInsertRowid));
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE')) {
      res.status(409).json({ error: 'Cette dépendance existe déjà.' });
      return;
    }
    if (String(error?.message || '').includes('cycle')) {
      res.status(409).json({ error: 'Cette dépendance créerait une boucle dans le planning.' });
      return;
    }
    throw error;
  }
});

router.delete('/projects/:id/task-dependencies/:dependencyId', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const projectId = Number(req.params.id);
  const dependencyId = Number(req.params.dependencyId);
  const db = getDb();
  const dependency = db.prepare('SELECT * FROM project_task_dependencies WHERE id = ? AND project_id = ?').get(dependencyId, projectId) as any;
  if (!dependency) {
    res.status(404).json({ error: 'Dépendance introuvable.' });
    return;
  }
  db.prepare('DELETE FROM project_task_dependencies WHERE id = ?').run(dependencyId);
  logAudit(req.user!, 'DELETE', 'project_task_dependency', dependencyId, `${dependency.predecessor_task_id} → ${dependency.successor_task_id}`, '');
  res.json({ ok: true });
});

router.post('/projects/:id/change-orders', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  if (!b.title?.trim()) {
    res.status(400).json({ error: 'L’intitulé de l’avenant est obligatoire.' });
    return;
  }
  const db = getDb();
  const ref = b.reference?.trim() || `AVN-CH${String(id).padStart(2, '0')}-${Date.now().toString().slice(-3)}`;
  const info = db
    .prepare(
      `INSERT INTO change_orders (project_id, reference, title, description, additional_price, additional_cost, approval_status)
       VALUES (?, ?, ?, ?, ?, ?, 'pending')`
    )
    .run(id, ref, b.title.trim(), b.description || '', Number(b.additional_price || 0), Number(b.additional_cost || 0));
  logAudit(req.user!, 'CREATE', 'change_order', ref, '', b.title.trim());
  res.status(201).json(db.prepare('SELECT * FROM change_orders WHERE id = ?').get(info.lastInsertRowid));
});

router.post('/projects/change-orders/:id/approve', requireAuth, requirePermission('projects:approve'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { decision } = req.body || {};
  const status = decision === 'rejected' ? 'rejected' : 'approved';
  const db = getDb();
  const old = db.prepare('SELECT * FROM change_orders WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Avenant introuvable.' });
    return;
  }
  db.prepare("UPDATE change_orders SET approval_status=?, approved_by=?, approved_at=datetime('now') WHERE id=?").run(
    status,
    req.user!.id,
    id
  );
  logAudit(req.user!, 'APPROVE', 'change_order', old.reference, old.approval_status, status);
  res.json(db.prepare('SELECT * FROM change_orders WHERE id = ?').get(id));
});

router.post('/contracts', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.client_id || !b.project_id || !b.contract_amount) {
    res.status(400).json({ error: 'Client, chantier et montant du contrat sont obligatoires.' });
    return;
  }
  const db = getDb();
  const amount = Number(b.contract_amount);
  const retRate = Number(b.retention_rate ?? 5);
  const retAmt = round2(amount * (retRate / 100));
  const ref = b.reference?.trim() || `CTR-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`;

  const info = db
    .prepare(
      `INSERT INTO contracts (reference, client_id, project_id, signing_date, start_date, planned_end_date, contract_amount, retention_rate, retention_amount, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`
    )
    .run(
      ref,
      Number(b.client_id),
      Number(b.project_id),
      b.signing_date || new Date().toISOString().slice(0, 10),
      b.start_date || new Date().toISOString().slice(0, 10),
      b.planned_end_date || null,
      amount,
      retRate,
      retAmt,
      b.notes || ''
    );
  const ctrId = info.lastInsertRowid as number;
  if (Array.isArray(b.milestones)) {
    for (const m of b.milestones) {
      db.prepare(
        'INSERT INTO contract_milestones (contract_id, title, due_date, expected_amount, received_amount, status, notes) VALUES (?, ?, ?, ?, 0, ?, ?)'
      ).run(ctrId, m.title, m.due_date || new Date().toISOString().slice(0, 10), Number(m.expected_amount || 0), 'pending', m.notes || '');
    }
  }
  logAudit(req.user!, 'CREATE', 'contract', ref, '', `${amount} DA`);
  res.status(201).json(db.prepare('SELECT * FROM contracts WHERE id = ?').get(ctrId));
});

router.put('/contracts/milestones/:id', requireAuth, requirePermission('projects:write'), (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM contract_milestones WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Jalon introuvable.' });
    return;
  }
  const received = b.received_amount !== undefined ? Number(b.received_amount) : old.received_amount;
  const status = received >= old.expected_amount ? 'paid' : received > 0 ? 'partial' : b.status || old.status;
  db.prepare('UPDATE contract_milestones SET received_amount=?, status=?, notes=? WHERE id=?').run(
    received,
    status,
    b.notes ?? old.notes,
    id
  );
  res.json(db.prepare('SELECT * FROM contract_milestones WHERE id = ?').get(id));
});

// ==================== COMMERCIAL DOCUMENTS & PAYMENTS ====================
const DOC_PREFIX_MAP: Record<string, string> = {
  devis: 'prefix_quote',
  proforma: 'prefix_proforma',
  bon_livraison: 'prefix_delivery',
  facture: 'prefix_invoice',
  avoir: 'prefix_credit',
};

// Optimistic concurrency: financial rows carry a revision, and a save must match the
// revision the user loaded. Two people editing the same invoice, payment or payroll
// period therefore cannot silently overwrite each other.
const REVISION_CONFLICT_MESSAGE =
  'Ce document a été modifié par un autre utilisateur depuis son ouverture. Rechargez la page pour reprendre la version à jour avant de réessayer.';

function readRevision(value: unknown): number | null {
  const revision = Number(value);
  return Number.isInteger(revision) && revision > 0 ? revision : null;
}

function sendRevisionRequired(res: express.Response) {
  res.status(400).json({ error: 'Numéro de révision manquant : rechargez le document avant de l’enregistrer.' });
}

function sendStaleRevision(res: express.Response) {
  res.status(409).json({ error: REVISION_CONFLICT_MESSAGE, stale: true });
}

router.get('/commercial-documents', requireAuth, requirePermission('invoices:read'), (_req, res) => {
  const db = getDb();
  const docs = db
    .prepare(
      `SELECT d.*, c.name AS client_name, c.nif AS client_nif, c.nis AS client_nis, c.rc AS client_rc, c.ai AS client_ai, c.address AS client_address, c.phone AS client_phone,
              p.title AS project_title, p.project_number
       FROM commercial_documents d
       JOIN clients c ON c.id = d.client_id
       LEFT JOIN projects p ON p.id = d.project_id
       ORDER BY d.id DESC`
    )
    .all() as any[];

  for (const doc of docs) {
    doc.lines = db
      .prepare('SELECT * FROM commercial_lines WHERE document_id = ? ORDER BY sort_order ASC, id ASC')
      .all(doc.id);
    doc.amount_in_words = amountToFrenchWords(doc.total_ttc);
  }
  res.json(docs);
});

function loadCommercialDocument(id: number) {
  const db = getDb();
  const doc = db
    .prepare(
      `SELECT d.*, c.name AS client_name, c.nif AS client_nif, c.nis AS client_nis, c.rc AS client_rc, c.ai AS client_ai, c.address AS client_address, c.phone AS client_phone,
              p.title AS project_title, p.project_number
       FROM commercial_documents d
       JOIN clients c ON c.id = d.client_id
       LEFT JOIN projects p ON p.id = d.project_id
       WHERE d.id = ?`
    )
    .get(id) as any;
  if (!doc) return null;
  doc.lines = db.prepare('SELECT * FROM commercial_lines WHERE document_id = ? ORDER BY sort_order ASC').all(id);
  doc.payments = db.prepare('SELECT * FROM payments WHERE document_id = ? ORDER BY payment_date DESC, id DESC').all(id);
  doc.amount_in_words = amountToFrenchWords(doc.total_ttc);
  return doc;
}

router.get('/commercial-documents/:id', requireAuth, requirePermission('invoices:read'), (req, res) => {
  const doc = loadCommercialDocument(Number(req.params.id));
  if (!doc) {
    res.status(404).json({ error: 'Document introuvable.' });
    return;
  }
  res.json(doc);
});

function computeDocLines(lines: any[], discountPercent = 0) {
  let sumHt = 0;
  let sumTva = 0;
  const computed = lines.map((l, idx) => {
    const qty = Number(l.quantity || 0);
    const price = Number(l.unit_price || 0);
    const tvaRate = Number(l.tva_rate ?? 19);
    const rawHt = round2(qty * price);
    const discountedHt = round2(rawHt * (1 - discountPercent / 100));
    const lineTva = round2(discountedHt * (tvaRate / 100));
    const lineTtc = round2(discountedHt + lineTva);
    sumHt += discountedHt;
    sumTva += lineTva;
    return {
      description: String(l.description || 'Prestation'),
      unit: String(l.unit || 'U'),
      quantity: qty,
      unit_price: price,
      tva_rate: tvaRate,
      line_ht: discountedHt,
      line_tva: lineTva,
      line_ttc: lineTtc,
      sort_order: idx + 1,
    };
  });
  return {
    lines: computed,
    total_ht: round2(sumHt),
    total_tva: round2(sumTva),
    total_ttc: round2(sumHt + sumTva),
  };
}

router.post('/commercial-documents', requireAuth, requirePermission('invoices:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.client_id || !Array.isArray(b.lines) || b.lines.length === 0) {
    res.status(400).json({ error: 'Client et au moins une ligne de facturation sont obligatoires.' });
    return;
  }
  const db = getDb();
  const docType = DOC_PREFIX_MAP[b.doc_type] ? String(b.doc_type) : 'devis';
  const settings = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as any;
  const prefixCol = DOC_PREFIX_MAP[docType] || 'prefix_quote';
  const prefix = settings?.[prefixCol] || 'DOC';
  let docNumber = '';

  const discount = Number(b.discount_percent || 0);
  const calc = computeDocLines(b.lines, discount);
  const status = b.issue_immediately ? 'issued' : 'draft';
  const lockedAt = b.issue_immediately ? new Date().toISOString() : null;

  const tx = db.transaction(() => {
    docNumber = generateNextNumber(prefix, 'commercial_documents', 'doc_number', `AND doc_type = '${docType}'`);
    const info = db
      .prepare(
        `INSERT INTO commercial_documents (doc_type, doc_number, client_id, project_id, linked_doc_id, issue_date, due_date, status, discount_percent, total_ht, total_tva, total_ttc, amount_paid, notes, created_by, locked_at, lifecycle_status, deletion_eligible_until)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'new', datetime('now', '+7 days'))`
      )
      .run(
        docType,
        docNumber,
        Number(b.client_id),
        b.project_id ? Number(b.project_id) : null,
        b.linked_doc_id ? Number(b.linked_doc_id) : null,
        b.issue_date || new Date().toISOString().slice(0, 10),
        b.due_date || null,
        status,
        discount,
        calc.total_ht,
        calc.total_tva,
        calc.total_ttc,
        b.notes || '',
        req.user!.id,
        lockedAt
      );
    const docId = info.lastInsertRowid as number;
    for (const l of calc.lines) {
      db.prepare(
        `INSERT INTO commercial_lines (document_id, description, unit, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(docId, l.description, l.unit, l.quantity, l.unit_price, l.tva_rate, l.line_ht, l.line_tva, l.line_ttc, l.sort_order);
    }
    return docId;
  });

  const docId = tx();
  logAudit(req.user!, 'CREATE', docType, docNumber, '', `TTC: ${calc.total_ttc} DA`);
  res.status(201).json(db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(docId));
});

router.put('/commercial-documents/:id', requireAuth, requirePermission('invoices:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const doc = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
  if (!doc) {
    res.status(404).json({ error: 'Document introuvable.' });
    return;
  }
  if (doc.locked_at || doc.status !== 'draft') {
    res.status(400).json({
      error: 'Document verrouillé : une facture émise ne peut pas être modifiée directement. Créez une facture d’avoir pour corriger.',
    });
    return;
  }
  const revision = readRevision(b.revision);
  if (revision === null) {
    sendRevisionRequired(res);
    return;
  }

  const discount = Number(b.discount_percent ?? doc.discount_percent);
  const calc = computeDocLines(b.lines || [], discount);

  const saved = db.transaction(() => {
    const updated = db
      .prepare(
        `UPDATE commercial_documents SET client_id=?, project_id=?, issue_date=?, due_date=?, discount_percent=?, total_ht=?, total_tva=?, total_ttc=?, notes=?, revision = revision + 1 WHERE id=? AND revision=?`
      )
      .run(
        Number(b.client_id ?? doc.client_id),
        b.project_id ? Number(b.project_id) : null,
        b.issue_date ?? doc.issue_date,
        b.due_date ?? doc.due_date,
        discount,
        calc.total_ht,
        calc.total_tva,
        calc.total_ttc,
        b.notes ?? doc.notes,
        id,
        revision
      );
    if (updated.changes === 0) return false;
    if (Array.isArray(b.lines)) {
      db.prepare('DELETE FROM commercial_lines WHERE document_id = ?').run(id);
      for (const l of calc.lines) {
        db.prepare(
          `INSERT INTO commercial_lines (document_id, description, unit, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(id, l.description, l.unit, l.quantity, l.unit_price, l.tva_rate, l.line_ht, l.line_tva, l.line_ttc, l.sort_order);
      }
    }
    return true;
  })();

  if (!saved) {
    sendStaleRevision(res);
    return;
  }

  logAudit(req.user!, 'UPDATE', doc.doc_type, doc.doc_number, '', `TTC: ${calc.total_ttc} DA`);
  res.json(db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id));
});

router.post('/commercial-documents/:id/issue', requireAuth, requirePermission('invoices:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const doc = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
  if (!doc) {
    res.status(404).json({ error: 'Document introuvable.' });
    return;
  }
  db.prepare("UPDATE commercial_documents SET status='issued', locked_at=datetime('now'), revision = revision + 1 WHERE id=?").run(id);
  logAudit(req.user!, 'ISSUE', doc.doc_type, doc.doc_number, doc.status, 'issued');
  res.json(db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id));
});

router.post('/commercial-documents/:id/convert-to-invoice', requireAuth, requirePermission('invoices:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const src = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
  if (!src) {
    res.status(404).json({ error: 'Devis ou proforma introuvable.' });
    return;
  }
  const lines = db.prepare('SELECT * FROM commercial_lines WHERE document_id = ? ORDER BY sort_order ASC').all(id) as any[];
  const settings = db.prepare('SELECT prefix_invoice FROM company_settings WHERE id = 1').get() as { prefix_invoice: string };
  let invNumber = '';
  const today = new Date().toISOString().slice(0, 10);
  const due = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const newId = db.transaction(() => {
    invNumber = generateNextNumber(settings?.prefix_invoice || 'FAC', 'commercial_documents', 'doc_number', "AND doc_type = 'facture'");
    const info = db
      .prepare(
        `INSERT INTO commercial_documents (doc_type, doc_number, client_id, project_id, linked_doc_id, issue_date, due_date, status, discount_percent, total_ht, total_tva, total_ttc, amount_paid, notes, created_by, locked_at, lifecycle_status, deletion_eligible_until)
         VALUES ('facture', ?, ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, 0, ?, ?, datetime('now'), 'new', datetime('now', '+7 days'))`
      )
      .run(invNumber, src.client_id, src.project_id, src.id, today, due, src.discount_percent, src.total_ht, src.total_tva, src.total_ttc, `Convertie depuis ${src.doc_number}`, req.user!.id);
    const invId = info.lastInsertRowid as number;
    for (const l of lines) {
      db.prepare(
        `INSERT INTO commercial_lines (document_id, description, unit, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(invId, l.description, l.unit, l.quantity, l.unit_price, l.tva_rate, l.line_ht, l.line_tva, l.line_ttc, l.sort_order);
    }
    db.prepare("UPDATE commercial_documents SET status = 'accepted', revision = revision + 1 WHERE id = ? AND doc_type = 'devis'").run(id);
    return invId;
  })();

  logAudit(req.user!, 'CONVERT', 'facture', invNumber, src.doc_number, `Créée depuis ${src.doc_number}`);
  res.status(201).json(db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(newId));
});

router.post('/commercial-documents/:id/credit-note', requireAuth, requirePermission('invoices:approve'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  const db = getDb();
  const src = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
  if (!src || src.doc_type !== 'facture') {
    res.status(400).json({ error: 'Une facture d’avoir ne peut être émise que sur une facture valide.' });
    return;
  }
  const lines = db.prepare('SELECT * FROM commercial_lines WHERE document_id = ? ORDER BY sort_order ASC').all(id) as any[];
  const settings = db.prepare('SELECT prefix_credit FROM company_settings WHERE id = 1').get() as { prefix_credit: string };
  let avoNumber = '';

  const avoId = db.transaction(() => {
    avoNumber = generateNextNumber(settings?.prefix_credit || 'AVO', 'commercial_documents', 'doc_number', "AND doc_type = 'avoir'");
    const info = db
      .prepare(
        `INSERT INTO commercial_documents (doc_type, doc_number, client_id, project_id, linked_doc_id, issue_date, status, discount_percent, total_ht, total_tva, total_ttc, amount_paid, notes, created_by, locked_at, lifecycle_status, deletion_eligible_until)
         VALUES ('avoir', ?, ?, ?, ?, ?, 'issued', ?, ?, ?, ?, 0, ?, ?, datetime('now'), 'new', datetime('now', '+7 days'))`
      )
      .run(
        avoNumber,
        src.client_id,
        src.project_id,
        src.id,
        new Date().toISOString().slice(0, 10),
        src.discount_percent,
        src.total_ht,
        src.total_tva,
        src.total_ttc,
        reason || `Annulation / Avoir sur facture ${src.doc_number}`,
        req.user!.id
      );
    const nid = info.lastInsertRowid as number;
    for (const l of lines) {
      db.prepare(
        `INSERT INTO commercial_lines (document_id, description, unit, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(nid, l.description, l.unit, l.quantity, l.unit_price, l.tva_rate, l.line_ht, l.line_tva, l.line_ttc, l.sort_order);
    }
    return nid;
  })();

  logAudit(req.user!, 'CREATE', 'avoir', avoNumber, src.doc_number, reason || 'Facture d’avoir');
  res.status(201).json(db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(avoId));
});

router.post('/commercial-documents/:id/payments', requireAuth, requirePermission('invoices:write'), (req: AuthedRequest, res) => {
  const docId = Number(req.params.id);
  const b = req.body || {};
  const amount = round2(Number(b.amount || 0));
  const payDate = b.payment_date || new Date().toISOString().slice(0, 10);
  const method = b.payment_method || 'Espèces';

  if (amount <= 0) {
    res.status(400).json({ error: 'Le montant du règlement doit être supérieur à 0 DA.' });
    return;
  }
  const db = getDb();
  const doc = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(docId) as any;
  if (!doc) {
    res.status(404).json({ error: 'Facture introuvable.' });
    return;
  }
  const remaining = round2(doc.total_ttc - doc.amount_paid);
  if (amount > remaining + 0.01) {
    res.status(400).json({ error: `Le montant saisi (${amount} DA) dépasse le reste à payer (${remaining} DA).` });
    return;
  }

  // Duplicate payment safeguard
  if (!b.confirm_duplicate) {
    const dup = db
      .prepare(
        `SELECT id, receipt_number FROM payments
         WHERE document_id = ? AND payment_date = ? AND ABS(amount - ?) < 0.01 AND is_reversal = 0 LIMIT 1`
      )
      .get(docId, payDate, amount) as any;
    if (dup) {
      res.status(409).json({
        duplicate_warning: true,
        error: `Alerte doublon : un règlement identique de ${amount} DA existe déjà le ${payDate} (${dup.receipt_number}). Confirmez-vous l'enregistrement ?`,
      });
      return;
    }
  }

  const settings = db.prepare('SELECT prefix_receipt FROM company_settings WHERE id = 1').get() as { prefix_receipt: string };
  let receiptNumber = '';

  const payId = db.transaction(() => {
    receiptNumber = generateNextNumber(settings?.prefix_receipt || 'REC', 'payments', 'receipt_number', "AND direction = 'inflow'");
    const pInfo = db
      .prepare(
        `INSERT INTO payments (receipt_number, direction, client_id, document_id, payment_date, amount, payment_method, reference, notes, user_id)
         VALUES (?, 'inflow', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(receiptNumber, doc.client_id, docId, payDate, amount, method, b.reference || '', b.notes || `Règlement ${doc.doc_number}`, req.user!.id);

    const newPaid = round2(doc.amount_paid + amount);
    const newStatus = newPaid >= doc.total_ttc - 0.01 ? 'paid' : 'partial';
    db.prepare('UPDATE commercial_documents SET amount_paid=?, status=?, revision = revision + 1 WHERE id=?').run(newPaid, newStatus, docId);

    // Record in treasury
    const account = method === 'Espèces' ? 'Caisse' : 'Banque';
    const txType = method === 'Espèces' ? 'cash_inflow' : 'bank_inflow';
    db.prepare(
      `INSERT INTO treasury_transactions (tx_date, tx_type, account, category, amount, payment_method, project_id, client_id, linked_payment_id, notes, user_id)
       VALUES (?, ?, ?, 'Règlement client', ?, ?, ?, ?, ?, ?, ?)`
    ).run(payDate, txType, account, amount, method, doc.project_id, doc.client_id, pInfo.lastInsertRowid, `${receiptNumber} — ${doc.doc_number}`, req.user!.id);

    return pInfo.lastInsertRowid;
  })();

  logAudit(req.user!, 'PAYMENT', 'facture', doc.doc_number, `${doc.amount_paid} DA`, `+${amount} DA (${receiptNumber})`);
  res.status(201).json(db.prepare('SELECT * FROM payments WHERE id = ?').get(payId));
});

router.post('/payments/:id/reverse', requireAuth, requirePermission('invoices:approve'), requirePermission('lifecycle:reverse'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  const db = getDb();
  const orig = db.prepare('SELECT * FROM payments WHERE id = ?').get(id) as any;
  if (!orig || orig.is_reversal) {
    res.status(400).json({ error: 'Paiement introuvable ou déjà contrepassé.' });
    return;
  }
  const alreadyReversed = db.prepare('SELECT id FROM payments WHERE reversed_payment_id = ?').get(id);
  if (alreadyReversed) {
    res.status(400).json({ error: 'Ce paiement a déjà fait l’objet d’une contre-passation.' });
    return;
  }

  const revision = readRevision(req.body?.revision);
  if (revision === null) {
    sendRevisionRequired(res);
    return;
  }

  const revNumber = `ANN-${orig.receipt_number}`;
  const reversed = db.transaction(() => {
    // Claim the payment at the revision the user saw, so a stale client cannot
    // reverse a payment another user already acted on.
    const claim = db.prepare('UPDATE payments SET revision = revision + 1 WHERE id = ? AND revision = ?').run(id, revision);
    if (claim.changes === 0) return false;
    const revInfo = db
      .prepare(
        `INSERT INTO payments (receipt_number, direction, client_id, supplier_id, document_id, purchase_id, payment_date, amount, payment_method, reference, is_reversal, reversed_payment_id, notes, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`
      )
      .run(
        revNumber,
        orig.direction,
        orig.client_id,
        orig.supplier_id,
        orig.document_id,
        orig.purchase_id,
        new Date().toISOString().slice(0, 10),
        -orig.amount,
        orig.payment_method,
        orig.reference,
        id,
        reason || `Contre-passation de ${orig.receipt_number}`,
        req.user!.id
      );

    if (orig.document_id) {
      const doc = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(orig.document_id) as any;
      if (doc) {
        const newPaid = Math.max(0, round2(doc.amount_paid - orig.amount));
        const newStatus = newPaid <= 0 ? 'issued' : newPaid >= doc.total_ttc - 0.01 ? 'paid' : 'partial';
        db.prepare('UPDATE commercial_documents SET amount_paid=?, status=?, revision = revision + 1 WHERE id=?').run(newPaid, newStatus, doc.id);
      }
    }

    // Supplier payment reversals must restore the purchase balance and its
    // operational status as well as reverse the corresponding treasury flow.
    if (orig.purchase_id) {
      const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(orig.purchase_id) as any;
      if (purchase) {
        const newPaid = Math.max(0, round2(Number(purchase.amount_paid || 0) - Number(orig.amount || 0)));
        const hasReceivedStock = !!db.prepare(
          "SELECT id FROM stock_movements WHERE reference = ? AND movement_type = 'entry' LIMIT 1"
        ).get(purchase.po_number);
        const newStatus = newPaid >= purchase.total_ttc - 0.01
          ? 'paid'
          : newPaid > 0
            ? 'partial_paid'
            : hasReceivedStock
              ? 'received'
              : 'ordered';
        db.prepare('UPDATE purchases SET amount_paid=?, status=? WHERE id=?').run(newPaid, newStatus, purchase.id);
      }
    }

    const account = orig.payment_method === 'Espèces' ? 'Caisse' : 'Banque';
    const txType = orig.direction === 'inflow' ? (account === 'Caisse' ? 'cash_outflow' : 'bank_outflow') : (account === 'Caisse' ? 'cash_inflow' : 'bank_inflow');
    db.prepare(
      `INSERT INTO treasury_transactions (tx_date, tx_type, account, category, amount, payment_method, client_id, supplier_id, linked_payment_id, notes, user_id)
       VALUES (?, ?, ?, 'Annulation règlement', ?, ?, ?, ?, ?, ?, ?)`
    ).run(new Date().toISOString().slice(0, 10), txType, account, orig.amount, orig.payment_method, orig.client_id, orig.supplier_id, revInfo.lastInsertRowid, reason || revNumber, req.user!.id);
    return true;
  })();

  if (!reversed) {
    sendStaleRevision(res);
    return;
  }

  logAudit(req.user!, 'REVERSE', 'payment', orig.receipt_number, `${orig.amount} DA`, reason || 'Contre-passation');
  res.json({ ok: true });
});

router.get('/payments', requireAuth, requirePermission('invoices:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.*, c.name AS client_name, s.name AS supplier_name, d.doc_number, pu.po_number AS purchase_number
       FROM payments p
       LEFT JOIN clients c ON c.id = p.client_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       LEFT JOIN commercial_documents d ON d.id = p.document_id
       LEFT JOIN purchases pu ON pu.id = p.purchase_id
       ORDER BY p.payment_date DESC, p.id DESC`
    )
    .all();
  res.json(rows);
});

// ==================== CONFIGURABLE WORK TYPES / SERVICE CATALOGUE ====================
// Existing quotations and project records remain compatible: service records are
// maintained as a catalogue and are never hard-deleted.
router.get('/services', requireAuth, requirePermission('settings:read'), (_req, res) => {
  const db = getDb();
  res.json(
    db.prepare('SELECT * FROM services ORDER BY active DESC, category COLLATE NOCASE ASC, name COLLATE NOCASE ASC').all()
  );
});

router.post('/services', requireAuth, requirePermission('settings:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  const unit = String(b.unit || '').trim();
  const defaultPrice = Number(b.default_price ?? 0);
  const costRate = Number(b.cost_rate ?? 0);
  const tvaRate = Number(b.tva_rate ?? 0);
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code) || !name || !unit) {
    res.status(400).json({ error: 'Code (2 à 30 caractères), nom et unité sont obligatoires.' });
    return;
  }
  if (![defaultPrice, costRate, tvaRate].every(Number.isFinite) || defaultPrice < 0 || costRate < 0 || tvaRate < 0 || tvaRate > 100) {
    res.status(400).json({ error: 'Les prix et coûts doivent être positifs ou nuls, et la TVA doit être comprise entre 0 et 100 %.' });
    return;
  }
  const db = getDb();
  try {
    const info = db.prepare(
      `INSERT INTO services (code, name, category, description, unit, default_price, cost_rate, tva_rate, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      code, name, String(b.category || 'Général').trim() || 'Général',
      String(b.description || '').trim(), unit, defaultPrice, costRate, tvaRate,
      b.active === false ? 0 : 1
    );
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid);
    logAudit(req.user!, 'CREATE', 'work_type', code, '', row);
    res.status(201).json(row);
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Ce code existe déjà. Choisissez un code différent.' });
      return;
    }
    throw error;
  }
});

router.put('/services/:id', requireAuth, requirePermission('settings:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM services WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Type de travaux introuvable.' });
    return;
  }
  const code = String(b.code ?? old.code).trim().toUpperCase();
  const name = String(b.name ?? old.name).trim();
  const unit = String(b.unit ?? old.unit).trim();
  const defaultPrice = Number(b.default_price ?? old.default_price);
  const costRate = Number(b.cost_rate ?? old.cost_rate);
  const tvaRate = Number(b.tva_rate ?? old.tva_rate);
  if (!/^[A-Z0-9][A-Z0-9_-]{1,29}$/.test(code) || !name || !unit) {
    res.status(400).json({ error: 'Code (2 à 30 caractères), nom et unité sont obligatoires.' });
    return;
  }
  if (![defaultPrice, costRate, tvaRate].every(Number.isFinite) || defaultPrice < 0 || costRate < 0 || tvaRate < 0 || tvaRate > 100) {
    res.status(400).json({ error: 'Les prix et coûts doivent être positifs ou nuls, et la TVA doit être comprise entre 0 et 100 %.' });
    return;
  }
  try {
    db.prepare(
      `UPDATE services SET code=?, name=?, category=?, description=?, unit=?, default_price=?, cost_rate=?, tva_rate=?, active=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(
      code, name, String(b.category ?? old.category).trim() || 'Général',
      String(b.description ?? old.description).trim(), unit, defaultPrice, costRate, tvaRate,
      b.active === undefined ? old.active : (b.active ? 1 : 0), id
    );
    const row = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
    logAudit(req.user!, 'UPDATE', 'work_type', code, old, row);
    res.json(row);
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE constraint failed')) {
      res.status(409).json({ error: 'Ce code existe déjà. Choisissez un code différent.' });
      return;
    }
    throw error;
  }
});

// ==================== WORKERS, ATTENDANCE & PAYROLL ====================
router.get('/workers', requireAuth, requirePermission('attendance:read'), (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM workers ORDER BY full_name ASC').all());
});

router.post('/workers', requireAuth, requirePermission('payroll:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const fullName = String(b.full_name || '').trim();
  const jobTitle = String(b.job_title || '').trim();
  const wageType = String(b.wage_type || 'daily');
  const amounts = [Number(b.daily_wage || 0), Number(b.hourly_rate || 0), Number(b.monthly_salary || 0)];
  const allowedStatuses = ['active', 'suspended', 'on_leave', 'terminated'];
  if (!fullName || !jobTitle) {
    res.status(400).json({ error: 'Le nom complet et le poste sont obligatoires.' });
    return;
  }
  if (!['daily', 'monthly', 'hourly', 'piecework'].includes(wageType)) {
    res.status(400).json({ error: 'Type de rémunération invalide.' });
    return;
  }
  if (!amounts.every((value) => Number.isFinite(value) && value >= 0)) {
    res.status(400).json({ error: 'Les montants de rémunération doivent être positifs ou nuls.' });
    return;
  }
  const status = String(b.status || 'active');
  if (!allowedStatuses.includes(status)) {
    res.status(400).json({ error: 'Statut du salarié invalide.' });
    return;
  }
  const hireDate = String(b.hire_date || new Date().toISOString().slice(0, 10));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDate) || Number.isNaN(Date.parse(hireDate))) {
    res.status(400).json({ error: 'Date d’embauche invalide (AAAA-MM-JJ).' });
    return;
  }
  const db = getDb();
  const info = db.prepare(
    `INSERT INTO workers (full_name, job_title, wage_type, daily_wage, hourly_rate, monthly_salary, work_schedule, hire_date, cnas_number, phone, address, status, notes, lifecycle_status, deletion_eligible_until)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', '+7 days'))`
  ).run(
    fullName, jobTitle, wageType, amounts[0], amounts[1], amounts[2],
    String(b.work_schedule || '08:00 - 16:30'), hireDate,
    String(b.cnas_number || '').trim(), String(b.phone || '').trim(),
    String(b.address || '').trim(), status, String(b.notes || '').trim()
  );
  logAudit(req.user!, 'CREATE', 'worker', info.lastInsertRowid, '', fullName);
  res.status(201).json(db.prepare('SELECT * FROM workers WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/workers/:id', requireAuth, requirePermission('payroll:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM workers WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Employé introuvable.' });
    return;
  }
  const fullName = String(b.full_name ?? old.full_name).trim();
  const jobTitle = String(b.job_title ?? old.job_title).trim();
  const wageType = String(b.wage_type ?? old.wage_type);
  const dailyWage = Number(b.daily_wage ?? old.daily_wage);
  const hourlyRate = Number(b.hourly_rate ?? old.hourly_rate);
  const monthlySalary = Number(b.monthly_salary ?? old.monthly_salary);
  const status = String(b.status ?? old.status);
  const hireDate = String(b.hire_date ?? old.hire_date);
  if (!fullName || !jobTitle) {
    res.status(400).json({ error: 'Le nom complet et le poste sont obligatoires.' });
    return;
  }
  if (!['daily', 'monthly', 'hourly', 'piecework'].includes(wageType)) {
    res.status(400).json({ error: 'Type de rémunération invalide.' });
    return;
  }
  if (![dailyWage, hourlyRate, monthlySalary].every((value) => Number.isFinite(value) && value >= 0)) {
    res.status(400).json({ error: 'Les montants de rémunération doivent être positifs ou nuls.' });
    return;
  }
  if (!['active', 'suspended', 'on_leave', 'terminated'].includes(status)) {
    res.status(400).json({ error: 'Statut du salarié invalide.' });
    return;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(hireDate) || Number.isNaN(Date.parse(hireDate))) {
    res.status(400).json({ error: 'Date d’embauche invalide (AAAA-MM-JJ).' });
    return;
  }
  db.prepare(
    `UPDATE workers SET full_name=?, job_title=?, wage_type=?, daily_wage=?, hourly_rate=?, monthly_salary=?, work_schedule=?, hire_date=?, cnas_number=?, phone=?, address=?, status=?, notes=? WHERE id=?`
  ).run(
    fullName, jobTitle, wageType, dailyWage, hourlyRate, monthlySalary,
    b.work_schedule ?? old.work_schedule, hireDate,
    b.cnas_number ?? old.cnas_number, b.phone ?? old.phone,
    b.address ?? old.address, status, b.notes ?? old.notes, id
  );
  logAudit(req.user!, 'UPDATE', 'worker', id, old.full_name, fullName);
  res.json(db.prepare('SELECT * FROM workers WHERE id = ?').get(id));
});

router.get('/attendance', requireAuth, requirePermission('attendance:read'), (req, res) => {
  const db = getDb();
  const { date, month, year, project_id, worker_id, approval_status } = req.query;
  const where: string[] = ['1=1'];
  const params: any[] = [];
  if (date) {
    where.push('a.attendance_date = ?');
    params.push(String(date));
  } else if (month && year) {
    where.push("substr(a.attendance_date, 1, 7) = ?");
    params.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  if (project_id) {
    where.push('a.project_id = ?');
    params.push(Number(project_id));
  }
  if (worker_id) {
    where.push('a.worker_id = ?');
    params.push(Number(worker_id));
  }
  if (approval_status) {
    where.push('a.approval_status = ?');
    params.push(String(approval_status));
  }

  const rows = db
    .prepare(
      `SELECT a.*, w.full_name AS worker_name, w.job_title, w.daily_wage, p.project_number, p.title AS project_title
       FROM attendance a
       JOIN workers w ON w.id = a.worker_id
       LEFT JOIN projects p ON p.id = a.project_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.attendance_date DESC, w.full_name ASC`
    )
    .all(...params);
  res.json(rows);
});

router.get('/attendance/export/xlsx', requireAuth, requirePermission('attendance:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT a.attendance_date AS Date, w.full_name AS Employé, w.job_title AS Poste, COALESCE(p.project_number,'') AS Chantier,
              a.status AS Statut, a.day_fraction AS Journée, a.overtime_hours AS HeuresSup, a.advance_amount AS Avance_DA, a.approval_status AS Validation
       FROM attendance a
       JOIN workers w ON w.id = a.worker_id
       LEFT JOIN projects p ON p.id = a.project_id
       ORDER BY a.attendance_date DESC`
    )
    .all();
  sendXlsx(res, 'pointage_gestionpro_dz.xlsx', [{ name: 'Pointage', rows }]);
});

router.post('/attendance', requireAuth, requirePermission('attendance:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const workerId = Number(b.worker_id);
  const attDate = b.attendance_date;
  const status = String(b.status || 'present');
  const dayFraction = status === 'absent' || status === 'unpaid_leave' ? 0 : status === 'half_day' ? 0.5 : Number(b.day_fraction ?? 1);
  const overtimeHours = Number(b.overtime_hours || 0);
  const advanceAmount = Number(b.advance_amount || 0);

  if (!workerId || !attDate || !/^\d{4}-\d{2}-\d{2}$/.test(String(attDate)) || Number.isNaN(Date.parse(String(attDate)))) {
    res.status(400).json({ error: 'Employé et date de pointage valide (AAAA-MM-JJ) sont obligatoires.' });
    return;
  }
  if (!['present', 'absent', 'half_day', 'paid_leave', 'unpaid_leave', 'sick_leave', 'holiday'].includes(status)) {
    res.status(400).json({ error: 'Statut de présence invalide.' });
    return;
  }
  if (!Number.isFinite(dayFraction) || dayFraction < 0 || dayFraction > 1 || !Number.isFinite(overtimeHours) || overtimeHours < 0 || !Number.isFinite(advanceAmount) || advanceAmount < 0) {
    res.status(400).json({ error: 'Journée, heures supplémentaires et avance doivent être des valeurs positives valides.' });
    return;
  }
  if ((status === 'present' || status === 'half_day') && !b.project_id) {
    res.status(400).json({ error: 'Veuillez sélectionner le chantier d’affectation pour ce pointage.' });
    return;
  }

  const db = getDb();
  const worker = db.prepare('SELECT status FROM workers WHERE id = ?').get(workerId) as { status: string } | undefined;
  if (!worker) {
    res.status(404).json({ error: 'Salarié introuvable.' });
    return;
  }
  if (worker.status === 'terminated' || worker.status === 'suspended') {
    res.status(400).json({ error: 'Ce salarié est sorti ou suspendu : le pointage est bloqué.' });
    return;
  }
  // Verify split-day fraction does not exceed 1.0 full day across projects on same date
  const existingRow = db
    .prepare(
      `SELECT COALESCE(SUM(day_fraction), 0) AS total
       FROM attendance
       WHERE worker_id = ? AND attendance_date = ?`
    )
    .get(workerId, attDate) as { total: number };

  if (existingRow.total + dayFraction > 1.001) {
    res.status(400).json({
      error: `Cumul journalier dépassé (${existingRow.total + dayFraction} j) : un ouvrier ne peut pas dépasser 1,0 journée sur une même date (${attDate}).`,
    });
    return;
  }

  // Check if month payroll is already approved/locked
  const ym = attDate.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const lockedPeriod = db
    .prepare("SELECT id FROM payroll_periods WHERE month = ? AND year = ? AND status = 'approved'")
    .get(m, y);
  if (lockedPeriod) {
    res.status(400).json({ error: `La paie de ${m}/${y} est déjà validée et verrouillée. Pointage bloqué.` });
    return;
  }

  const info = db
    .prepare(
      `INSERT INTO attendance (attendance_date, worker_id, project_id, status, day_fraction, overtime_hours, advance_amount, notes, approval_status, entered_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    )
    .run(
      attDate,
      workerId,
      b.project_id ? Number(b.project_id) : null,
      status,
      dayFraction,
      overtimeHours,
      advanceAmount,
      b.notes || '',
      req.user!.id
    );
  logAudit(req.user!, 'CREATE', 'attendance', info.lastInsertRowid, '', `${attDate} — ${dayFraction}j`);
  res.status(201).json(db.prepare('SELECT * FROM attendance WHERE id = ?').get(info.lastInsertRowid));
});


router.put('/attendance/:id', requireAuth, requirePermission('attendance:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id) as any;
  if (!old) { res.status(404).json({ error: 'Pointage introuvable.' }); return; }
  if (old.approval_status !== 'pending') { res.status(400).json({ error: 'Seuls les pointages en attente peuvent être modifiés. Un pointage validé reste protégé pour la paie.' }); return; }
  const workerId = Number(b.worker_id);
  const attDate = String(b.attendance_date || '');
  const status = String(b.status || 'present');
  const dayFraction = status === 'absent' || status === 'unpaid_leave' ? 0 : status === 'half_day' ? 0.5 : Number(b.day_fraction ?? 1);
  const overtimeHours = Number(b.overtime_hours || 0);
  const advanceAmount = Number(b.advance_amount || 0);
  if (!workerId || !/^\d{4}-\d{2}-\d{2}$/.test(attDate) || !['present','absent','half_day','paid_leave','unpaid_leave','sick_leave','holiday'].includes(status) ||
      !Number.isFinite(dayFraction) || dayFraction < 0 || dayFraction > 1 || !Number.isFinite(overtimeHours) || overtimeHours < 0 || !Number.isFinite(advanceAmount) || advanceAmount < 0) {
    res.status(400).json({ error: 'Vérifiez le salarié, la date, le statut et les montants du pointage.' }); return;
  }
  if ((status === 'present' || status === 'half_day') && !b.project_id) { res.status(400).json({ error: 'Veuillez sélectionner le chantier d’affectation.' }); return; }
  const worker = db.prepare('SELECT status FROM workers WHERE id=?').get(workerId) as any;
  if (!worker || ['terminated','suspended'].includes(worker.status)) { res.status(400).json({ error: 'Ce salarié ne peut pas être pointé.' }); return; }
  const existing = db.prepare('SELECT COALESCE(SUM(day_fraction),0) AS total FROM attendance WHERE worker_id=? AND attendance_date=? AND id<>?').get(workerId,attDate,id) as any;
  if (existing.total + dayFraction > 1.001) { res.status(400).json({ error: 'Le cumul journalier de cet employé dépasserait une journée.' }); return; }
  const [year,month] = attDate.slice(0,7).split('-').map(Number);
  if (db.prepare("SELECT id FROM payroll_periods WHERE month=? AND year=? AND status='approved'").get(month,year)) { res.status(400).json({ error: 'La paie de cette période est verrouillée.' }); return; }
  db.prepare('UPDATE attendance SET attendance_date=?, worker_id=?, project_id=?, status=?, day_fraction=?, overtime_hours=?, advance_amount=?, notes=? WHERE id=?').run(
    attDate, workerId, b.project_id ? Number(b.project_id) : null, status, dayFraction, overtimeHours, advanceAmount, b.notes || '', id
  );
  logAudit(req.user!, 'UPDATE', 'attendance', id, old.attendance_date, attDate);
  res.json(db.prepare('SELECT * FROM attendance WHERE id=?').get(id));
});

router.delete('/attendance/:id', requireAuth, requirePermission('attendance:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM attendance WHERE id = ?').get(id) as any;
  if (!row) {
    res.status(404).json({ error: 'Pointage introuvable.' });
    return;
  }
  if (row.approval_status === 'approved' && req.user!.role !== 'admin') {
    res.status(403).json({ error: 'Seul l’administrateur peut supprimer un pointage déjà validé.' });
    return;
  }
  db.prepare('DELETE FROM attendance WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'attendance', id, row.attendance_date, '');
  res.json({ ok: true });
});

router.post('/attendance/approve', requireAuth, requirePermission('attendance:approve'), (req: AuthedRequest, res) => {
  const { ids, date, month, year } = req.body || {};
  const db = getDb();
  let count = 0;

  if (Array.isArray(ids) && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const info = db
      .prepare(
        `UPDATE attendance SET approval_status='approved', approved_by=?, approved_at=datetime('now') WHERE id IN (${placeholders}) AND approval_status='pending'`
      )
      .run(req.user!.id, ...ids.map(Number));
    count = info.changes;
  } else if (date) {
    const info = db
      .prepare(
        `UPDATE attendance SET approval_status='approved', approved_by=?, approved_at=datetime('now') WHERE attendance_date=? AND approval_status='pending'`
      )
      .run(req.user!.id, String(date));
    count = info.changes;
  } else if (month && year) {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    const info = db
      .prepare(
        `UPDATE attendance SET approval_status='approved', approved_by=?, approved_at=datetime('now') WHERE substr(attendance_date,1,7)=? AND approval_status='pending'`
      )
      .run(req.user!.id, ym);
    count = info.changes;
  } else {
    const info = db
      .prepare(
        `UPDATE attendance SET approval_status='approved', approved_by=?, approved_at=datetime('now') WHERE approval_status='pending'`
      )
      .run(req.user!.id);
    count = info.changes;
  }

  logAudit(req.user!, 'APPROVE', 'attendance', `${count} lignes`, 'pending', 'approved');
  res.json({ approvedCount: count });
});

router.get('/payroll/periods', requireAuth, requirePermission('payroll:read'), (_req, res) => {
  const db = getDb();
  const periods = db
    .prepare(
      `SELECT pp.*,
         (SELECT COUNT(*) FROM payslips ps WHERE ps.payroll_period_id = pp.id) AS slip_count,
         (SELECT COALESCE(SUM(gross_salary), 0) FROM payslips ps WHERE ps.payroll_period_id = pp.id) AS total_gross,
         (SELECT COALESCE(SUM(net_pay), 0) FROM payslips ps WHERE ps.payroll_period_id = pp.id) AS total_net,
         (SELECT COALESCE(SUM(cnas_employee + cnas_employer), 0) FROM payslips ps WHERE ps.payroll_period_id = pp.id) AS total_cnas,
         (SELECT COALESCE(SUM(irg_amount), 0) FROM payslips ps WHERE ps.payroll_period_id = pp.id) AS total_irg
       FROM payroll_periods pp ORDER BY year DESC, month DESC`
    )
    .all();
  res.json(periods);
});

router.get('/payroll/periods/:id', requireAuth, requirePermission('payroll:read'), (req, res) => {
  const db = getDb();
  const id = Number(req.params.id);
  const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(id);
  if (!period) {
    res.status(404).json({ error: 'Période de paie introuvable.' });
    return;
  }
  const payslips = db
    .prepare(
      `SELECT ps.*, w.full_name, w.job_title, w.cnas_number, w.wage_type, w.daily_wage, w.hire_date
       FROM payslips ps
       JOIN workers w ON w.id = ps.worker_id
       WHERE ps.payroll_period_id = ?
       ORDER BY w.full_name ASC`
    )
    .all(id);
  res.json({ period, payslips });
});

router.post('/payroll/calculate', requireAuth, requirePermission('payroll:write'), (req: AuthedRequest, res) => {
  const month = Number(req.body?.month);
  const year = Number(req.body?.year);
  if (!month || !year) {
    res.status(400).json({ error: 'Mois et année obligatoires.' });
    return;
  }
  const db = getDb();
  const existing = db.prepare('SELECT * FROM payroll_periods WHERE month = ? AND year = ?').get(month, year) as any;
  if (existing && existing.status === 'approved') {
    res.status(400).json({ error: `La paie ${month}/${year} est déjà validée et verrouillée.` });
    return;
  }

  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const cnasEmpRate = getTaxRate('CNAS_EMP', 9) / 100;
  const cnasPatRate = getTaxRate('CNAS_PAT', 26) / 100;
  const irgConfig = getTaxConfigFromDb();

  const periodId = db.transaction(() => {
    let pid = existing?.id as number | undefined;
    if (!pid) {
      const info = db
        .prepare("INSERT INTO payroll_periods (month, year, status, payment_method) VALUES (?, ?, 'draft', 'Espèces')")
        .run(month, year);
      pid = info.lastInsertRowid as number;
    }

    const workers = db.prepare("SELECT * FROM workers WHERE status != 'terminated'").all() as any[];
    for (const w of workers) {
      const att = db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN status IN ('present','half_day','paid_leave','holiday') THEN day_fraction ELSE 0 END), 0) AS days,
             COALESCE(SUM(overtime_hours), 0) AS ot,
             COALESCE(SUM(advance_amount), 0) AS adv
           FROM attendance
           WHERE worker_id = ? AND substr(attendance_date, 1, 7) = ? AND approval_status = 'approved'`
        )
        .get(w.id, ym) as { days: number; ot: number; adv: number };

      if (att.days === 0 && att.adv === 0 && w.wage_type !== 'monthly') {
        continue;
      }

      let baseGross = 0;
      let otPay = 0;
      if (w.wage_type === 'monthly') {
        baseGross = round2(w.monthly_salary);
        otPay = round2(att.ot * (w.monthly_salary / 176) * 1.5);
      } else if (w.wage_type === 'hourly') {
        baseGross = round2(att.days * 8 * w.hourly_rate);
        otPay = round2(att.ot * w.hourly_rate * 1.5);
      } else {
        baseGross = round2(att.days * w.daily_wage);
        otPay = round2(att.ot * (w.daily_wage / 8) * 1.5);
      }

      const prevSlip = db
        .prepare('SELECT bonus_amount, piecework_amount, penalties_deducted, other_deductions FROM payslips WHERE payroll_period_id=? AND worker_id=?')
        .get(pid, w.id) as any;

      const bonus = prevSlip?.bonus_amount ?? 0;
      const piece = prevSlip?.piecework_amount ?? 0;
      const penalties = prevSlip?.penalties_deducted ?? 0;
      const otherDed = prevSlip?.other_deductions ?? 0;

      const gross = round2(baseGross + otPay + bonus + piece);
      const cnasEmp = Math.round(gross * cnasEmpRate);
      const cnasPat = Math.round(gross * cnasPatRate);
      const taxable = Math.max(0, gross - cnasEmp);
      const irg = calculateAlgerianIRG(taxable, irgConfig);
      const net = Math.max(0, round2(gross - cnasEmp - irg - att.adv - penalties - otherDed));

      db.prepare(
        `INSERT INTO payslips (payroll_period_id, worker_id, worked_days, overtime_hours, base_gross, overtime_pay, bonus_amount, piecework_amount, gross_salary, cnas_employee, cnas_employer, irg_amount, advances_deducted, penalties_deducted, other_deductions, net_pay, locked)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(payroll_period_id, worker_id) DO UPDATE SET
           worked_days=excluded.worked_days, overtime_hours=excluded.overtime_hours,
           base_gross=excluded.base_gross, overtime_pay=excluded.overtime_pay,
           gross_salary=excluded.gross_salary, cnas_employee=excluded.cnas_employee,
           cnas_employer=excluded.cnas_employer, irg_amount=excluded.irg_amount,
           advances_deducted=excluded.advances_deducted, net_pay=excluded.net_pay,
           revision = payslips.revision + 1`
      ).run(pid, w.id, att.days, att.ot, baseGross, otPay, bonus, piece, gross, cnasEmp, cnasPat, irg, att.adv, penalties, otherDed, net);
    }

    db.prepare('UPDATE payroll_periods SET revision = revision + 1 WHERE id = ?').run(pid);
    return pid;
  })();

  logAudit(req.user!, 'CALCULATE', 'payroll_period', `${month}/${year}`, '', 'Calcul paie sur pointages validés');
  res.json({ periodId });
});

router.put('/payroll/payslips/:id', requireAuth, requirePermission('payroll:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const slip = db.prepare('SELECT * FROM payslips WHERE id = ?').get(id) as any;
  if (!slip) {
    res.status(404).json({ error: 'Bulletin introuvable.' });
    return;
  }
  if (slip.locked) {
    res.status(400).json({ error: 'Ce bulletin est verrouillé car la période de paie a été validée.' });
    return;
  }
  const bonus = Number(b.bonus_amount ?? slip.bonus_amount);
  const piece = Number(b.piecework_amount ?? slip.piecework_amount);
  const penalties = Number(b.penalties_deducted ?? slip.penalties_deducted);
  const otherDed = Number(b.other_deductions ?? slip.other_deductions);

  const gross = round2(slip.base_gross + slip.overtime_pay + bonus + piece);
  const cnasEmp = Math.round(gross * (getTaxRate('CNAS_EMP', 9) / 100));
  const cnasPat = Math.round(gross * (getTaxRate('CNAS_PAT', 26) / 100));
  const irg = calculateAlgerianIRG(Math.max(0, gross - cnasEmp), getTaxConfigFromDb());
  const net = Math.max(0, round2(gross - cnasEmp - irg - slip.advances_deducted - penalties - otherDed));

  const revision = readRevision(b.revision);
  if (revision === null) {
    sendRevisionRequired(res);
    return;
  }

  const saved = db
    .prepare(
      `UPDATE payslips SET bonus_amount=?, piecework_amount=?, gross_salary=?, cnas_employee=?, cnas_employer=?, irg_amount=?, penalties_deducted=?, other_deductions=?, net_pay=?, revision = revision + 1 WHERE id=? AND revision=?`
    )
    .run(bonus, piece, gross, cnasEmp, cnasPat, irg, penalties, otherDed, net, id, revision);
  if (saved.changes === 0) {
    sendStaleRevision(res);
    return;
  }

  logAudit(req.user!, 'UPDATE', 'payslip', id, `${slip.net_pay} DA`, `${net} DA`);
  res.json(db.prepare('SELECT * FROM payslips WHERE id = ?').get(id));
});

router.post('/payroll/periods/:id/approve', requireAuth, requirePermission('payroll:approve'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const period = db.prepare('SELECT * FROM payroll_periods WHERE id = ?').get(id) as any;
  if (!period) {
    res.status(404).json({ error: 'Période introuvable.' });
    return;
  }
  if (period.status === 'approved') {
    res.status(400).json({ error: 'Cette période est déjà validée.' });
    return;
  }

  const revision = readRevision(req.body?.revision);
  if (revision === null) {
    sendRevisionRequired(res);
    return;
  }

  const approved = db.transaction(() => {
    const claim = db
      .prepare("UPDATE payroll_periods SET status='approved', approved_by=?, approved_at=datetime('now'), revision = revision + 1 WHERE id=? AND revision=?")
      .run(req.user!.id, id, revision);
    if (claim.changes === 0) return false;
    db.prepare('UPDATE payslips SET locked=1, revision = revision + 1 WHERE payroll_period_id=?').run(id);
    const tot = db.prepare('SELECT COALESCE(SUM(net_pay), 0) AS net FROM payslips WHERE payroll_period_id=?').get(id) as { net: number };
    if (tot.net > 0) {
      db.prepare(
        `INSERT INTO treasury_transactions (tx_date, tx_type, account, category, amount, payment_method, notes, user_id)
         VALUES (?, 'cash_outflow', 'Caisse', 'Salaires & Paie', ?, ?, ?, ?)`
      ).run(new Date().toISOString().slice(0, 10), tot.net, period.payment_method || 'Espèces', `Décaissement paie ${period.month}/${period.year}`, req.user!.id);
    }
    return true;
  })();

  if (!approved) {
    sendStaleRevision(res);
    return;
  }

  logAudit(req.user!, 'APPROVE', 'payroll_period', `${period.month}/${period.year}`, 'draft', 'approved');
  res.json({ ok: true });
});

router.get('/payroll/periods/:id/export/xlsx', requireAuth, requirePermission('payroll:read'), (req, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT w.full_name AS Employé, w.job_title AS Poste, w.cnas_number AS N_CNAS,
              ps.worked_days AS Jours, ps.overtime_hours AS Heures_Sup, ps.base_gross AS Salaire_Base,
              ps.bonus_amount AS Primes, ps.gross_salary AS Salaire_Brut,
              ps.cnas_employee AS CNAS_Salarié_9pct, ps.cnas_employer AS CNAS_Employeur_26pct,
              ps.irg_amount AS IRG_DA, ps.advances_deducted AS Avances_DA, ps.net_pay AS Net_à_Payer_DA
       FROM payslips ps JOIN workers w ON w.id = ps.worker_id WHERE ps.payroll_period_id = ?`
    )
    .all(id);
  sendXlsx(res, `paie_periode_${id}_gestionpro_dz.xlsx`, [{ name: 'Paie_CNAS_IRG', rows }]);
});

// ==================== MATERIALS & STOCK ====================
router.get('/materials', requireAuth, requirePermission('materials:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT m.*, s.name AS supplier_name
       FROM materials m LEFT JOIN suppliers s ON s.id = m.preferred_supplier_id
       ORDER BY m.name ASC`
    )
    .all();
  res.json(rows);
});

router.get('/materials/export/xlsx', requireAuth, requirePermission('materials:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT code AS Code, name AS Désignation, category AS Catégorie, unit AS Unité,
              current_quantity AS Stock_Actuel, min_stock_level AS Stock_Min, purchase_price AS Prix_Achat_DA,
              storage_location AS Emplacement FROM materials ORDER BY name ASC`
    )
    .all();
  sendXlsx(res, 'stock_materiaux_gestionpro_dz.xlsx', [{ name: 'Stock', rows }]);
});

router.post('/materials', requireAuth, requirePermission('materials:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.name?.trim() || !b.code?.trim()) {
    res.status(400).json({ error: 'Désignation et code matériau sont obligatoires.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO materials (name, code, category, unit, current_quantity, purchase_price, selling_price, min_stock_level, preferred_supplier_id, storage_location, lifecycle_status, deletion_eligible_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', '+7 days'))`
    )
    .run(
      b.name.trim(),
      b.code.trim(),
      b.category || 'Divers',
      b.unit || 'U',
      Number(b.current_quantity || 0),
      Number(b.purchase_price || 0),
      Number(b.selling_price || 0),
      Number(b.min_stock_level || 0),
      b.preferred_supplier_id ? Number(b.preferred_supplier_id) : null,
      b.storage_location || 'Dépôt principal'
    );
  logAudit(req.user!, 'CREATE', 'material', b.code.trim(), '', b.name.trim());
  res.status(201).json(db.prepare('SELECT * FROM materials WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/materials/:id', requireAuth, requirePermission('materials:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const old = db.prepare('SELECT * FROM materials WHERE id = ?').get(id) as any;
  if (!old) { res.status(404).json({ error: 'Matériau introuvable.' }); return; }
  const b = req.body || {};
  const name = String(b.name ?? old.name).trim();
  const code = String(b.code ?? old.code).trim();
  if (!name || !code) { res.status(400).json({ error: 'Désignation et code matériau sont obligatoires.' }); return; }
  if (b.status === 'inactive' && Number(old.current_quantity) > 0) { res.status(400).json({ error: 'Impossible d’archiver un matériau tant qu’un stock positif est disponible.' }); return; }
  db.prepare(`UPDATE materials SET name=?, code=?, category=?, unit=?, purchase_price=?, selling_price=?, min_stock_level=?, preferred_supplier_id=?, storage_location=?, status=? WHERE id=?`).run(
    name, code, b.category ?? old.category, b.unit ?? old.unit,
    Number(b.purchase_price ?? old.purchase_price), Number(b.selling_price ?? old.selling_price),
    Number(b.min_stock_level ?? old.min_stock_level),
    b.preferred_supplier_id === undefined ? old.preferred_supplier_id : (b.preferred_supplier_id ? Number(b.preferred_supplier_id) : null),
    b.storage_location ?? old.storage_location, b.status === 'inactive' ? 'inactive' : b.status === 'active' ? 'active' : old.status, id
  );
  logAudit(req.user!, 'UPDATE', 'material', code, old.name, name);
  res.json(db.prepare('SELECT * FROM materials WHERE id = ?').get(id));
});

router.get('/stock-movements', requireAuth, requirePermission('materials:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT sm.*, m.name AS material_name, m.unit, p.project_number, p.title AS project_title, s.name AS supplier_name, u.name AS user_name
       FROM stock_movements sm
       JOIN materials m ON m.id = sm.material_id
       LEFT JOIN projects p ON p.id = sm.project_id
       LEFT JOIN suppliers s ON s.id = sm.supplier_id
       LEFT JOIN users u ON u.id = sm.user_id
       ORDER BY sm.movement_date DESC, sm.id DESC`
    )
    .all();
  res.json(rows);
});

router.post('/stock-movements', requireAuth, requirePermission('materials:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const mType = b.movement_type;
  const materialId = Number(b.material_id);
  const qty = Number(b.quantity || 0);

  if (!materialId || qty <= 0) {
    res.status(400).json({ error: 'Matériau et quantité strictement positive sont obligatoires.' });
    return;
  }
  if ((mType === 'exit' || mType === 'return') && !b.project_id) {
    res.status(400).json({ error: 'Une sortie ou un retour de stock doit obligatoirement indiquer le chantier de destination.' });
    return;
  }

  const db = getDb();
  const mat = db.prepare('SELECT * FROM materials WHERE id = ?').get(materialId) as any;
  if (!mat) {
    res.status(404).json({ error: 'Matériau introuvable.' });
    return;
  }

  if (mType === 'adjustment' && req.user!.role !== 'admin' && req.user!.role !== 'storekeeper') {
    res.status(403).json({ error: 'Ajustement réservé au gérant ou au magasinier.' });
    return;
  }

  const isOut = mType === 'exit' || mType === 'loss';
  if (isOut && mat.current_quantity < qty) {
    res.status(400).json({
      error: `Stock insuffisant pour « ${mat.name} » : disponible ${mat.current_quantity} ${mat.unit}, demandé ${qty} ${mat.unit}.`,
    });
    return;
  }

  const unitCost = Number(b.unit_cost || mat.purchase_price || 0);
  const totalCost = round2(qty * unitCost);

  const movId = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO stock_movements (movement_type, material_id, quantity, unit_cost, total_cost, project_id, supplier_id, from_location, to_location, reference, notes, movement_date, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        mType,
        materialId,
        qty,
        unitCost,
        totalCost,
        b.project_id ? Number(b.project_id) : null,
        b.supplier_id ? Number(b.supplier_id) : null,
        b.from_location || (mType === 'entry' ? 'Fournisseur' : mat.storage_location),
        b.to_location || (mType === 'exit' ? 'Chantier' : mat.storage_location),
        b.reference || `MVT-${Date.now().toString().slice(-5)}`,
        b.notes || '',
        b.movement_date || new Date().toISOString().slice(0, 10),
        req.user!.id
      );

    let newQty = mat.current_quantity;
    if (mType === 'entry' || mType === 'return') newQty = round2(mat.current_quantity + qty);
    else if (mType === 'exit' || mType === 'loss') newQty = round2(mat.current_quantity - qty);
    else if (mType === 'adjustment') newQty = Number(b.new_quantity ?? mat.current_quantity);

    db.prepare('UPDATE materials SET current_quantity=?, purchase_price=? WHERE id=?').run(
      newQty,
      mType === 'entry' && unitCost > 0 ? unitCost : mat.purchase_price,
      materialId
    );
    return info.lastInsertRowid;
  })();

  logAudit(req.user!, 'STOCK_' + String(mType).toUpperCase(), 'material', mat.code, `${mat.current_quantity}`, `Qte: ${qty}`);
  res.status(201).json(db.prepare('SELECT * FROM stock_movements WHERE id = ?').get(movId));
});

// ==================== SUPPLIERS & PURCHASES ====================
router.get('/suppliers', requireAuth, requirePermission('suppliers:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT s.*,
        (SELECT COALESCE(SUM(total_ttc - amount_paid), 0) FROM purchases p WHERE p.supplier_id = s.id AND p.status NOT IN ('paid','cancelled')) AS balance_due
       FROM suppliers s ORDER BY s.name ASC`
    )
    .all();
  res.json(rows);
});

router.post('/suppliers', requireAuth, requirePermission('suppliers:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.name?.trim()) {
    res.status(400).json({ error: 'Le nom du fournisseur est obligatoire.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO suppliers (name, contact_name, phone, email, address, nif, nis, rc, ai, payment_terms, notes, lifecycle_status, deletion_eligible_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', '+7 days'))`
    )
    .run(b.name.trim(), b.contact_name || '', b.phone || '', b.email || '', b.address || '', b.nif || '', b.nis || '', b.rc || '', b.ai || '', b.payment_terms || '30 jours', b.notes || '');
  logAudit(req.user!, 'CREATE', 'supplier', info.lastInsertRowid, '', b.name.trim());
  res.status(201).json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/suppliers/:id', requireAuth, requirePermission('suppliers:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const old = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id) as any;
  if (!old) { res.status(404).json({ error: 'Fournisseur introuvable.' }); return; }
  const b = req.body || {};
  const name = String(b.name ?? old.name).trim();
  if (!name) { res.status(400).json({ error: 'Le nom du fournisseur est obligatoire.' }); return; }
  db.prepare(`UPDATE suppliers SET name=?, contact_name=?, phone=?, email=?, address=?, nif=?, nis=?, rc=?, ai=?, payment_terms=?, notes=?, status=? WHERE id=?`).run(
    name, b.contact_name ?? old.contact_name, b.phone ?? old.phone, b.email ?? old.email,
    b.address ?? old.address, b.nif ?? old.nif, b.nis ?? old.nis, b.rc ?? old.rc,
    b.ai ?? old.ai, b.payment_terms ?? old.payment_terms, b.notes ?? old.notes, b.status === 'inactive' ? 'inactive' : b.status === 'active' ? 'active' : old.status, id
  );
  logAudit(req.user!, 'UPDATE', 'supplier', id, old.name, name);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(id));
});

router.get('/purchases', requireAuth, requirePermission('suppliers:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT pu.*, s.name AS supplier_name, p.project_number, p.title AS project_title
       FROM purchases pu
       JOIN suppliers s ON s.id = pu.supplier_id
       LEFT JOIN projects p ON p.id = pu.project_id
       ORDER BY pu.id DESC`
    )
    .all() as any[];
  for (const r of rows) {
    r.lines = db.prepare('SELECT * FROM purchase_lines WHERE purchase_id = ?').all(r.id);
  }
  res.json(rows);
});

router.post('/purchases', requireAuth, requirePermission('suppliers:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.supplier_id || !Array.isArray(b.lines) || b.lines.length === 0) {
    res.status(400).json({ error: 'Fournisseur et lignes de commande sont obligatoires.' });
    return;
  }
  const db = getDb();
  const settings = db.prepare('SELECT prefix_po FROM company_settings WHERE id = 1').get() as { prefix_po: string };
  let poNumber = '';

  let sumHt = 0;
  let sumTva = 0;
  const lines = b.lines.map((l: any) => {
    const qty = Number(l.quantity || 1);
    const up = Number(l.unit_price || 0);
    const tva = Number(l.tva_rate ?? 19);
    const ht = round2(qty * up);
    const tvaAmt = round2(ht * (tva / 100));
    sumHt += ht;
    sumTva += tvaAmt;
    return {
      material_id: l.material_id ? Number(l.material_id) : null,
      description: l.description || 'Article',
      quantity: qty,
      unit_price: up,
      tva_rate: tva,
      line_total: round2(ht + tvaAmt),
    };
  });

  const poId = db.transaction(() => {
    poNumber = generateNextNumber(settings?.prefix_po || 'BC', 'purchases', 'po_number');
    const info = db
      .prepare(
        `INSERT INTO purchases (po_number, supplier_invoice_no, supplier_id, project_id, order_date, status, total_ht, total_tva, total_ttc, amount_paid, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        poNumber,
        b.supplier_invoice_no || '',
        Number(b.supplier_id),
        b.project_id ? Number(b.project_id) : null,
        b.order_date || new Date().toISOString().slice(0, 10),
        b.receive_immediately ? 'received' : 'ordered',
        round2(sumHt),
        round2(sumTva),
        round2(sumHt + sumTva),
        b.notes || '',
        req.user!.id
      );
    const pid = info.lastInsertRowid as number;
    for (const l of lines) {
      db.prepare(
        'INSERT INTO purchase_lines (purchase_id, material_id, description, quantity, unit_price, tva_rate, line_total) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(pid, l.material_id, l.description, l.quantity, l.unit_price, l.tva_rate, l.line_total);
      if (b.receive_immediately && l.material_id) {
        db.prepare('UPDATE materials SET current_quantity = current_quantity + ?, purchase_price = ? WHERE id = ?').run(
          l.quantity,
          l.unit_price,
          l.material_id
        );
        db.prepare(
          `INSERT INTO stock_movements (movement_type, material_id, quantity, unit_cost, total_cost, supplier_id, from_location, to_location, reference, movement_date, user_id)
           VALUES ('entry', ?, ?, ?, ?, ?, 'Fournisseur', 'Dépôt principal', ?, ?, ?)`
        ).run(l.material_id, l.quantity, l.unit_price, round2(l.quantity * l.unit_price), Number(b.supplier_id), poNumber, b.order_date || new Date().toISOString().slice(0, 10), req.user!.id);
      }
    }
    return pid;
  })();

  logAudit(req.user!, 'CREATE', 'purchase', poNumber, '', `TTC: ${round2(sumHt + sumTva)} DA`);
  res.status(201).json(db.prepare('SELECT * FROM purchases WHERE id = ?').get(poId));
});

router.post('/purchases/:id/cancel', requireAuth, requirePermission('suppliers:write'), requirePermission('lifecycle:cancel'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const purchase = db.prepare('SELECT * FROM purchases WHERE id=?').get(id) as any;
  if (!purchase) { res.status(404).json({ error: 'Bon de commande introuvable.' }); return; }
  if (!['ordered','requested'].includes(purchase.status) || Number(purchase.amount_paid || 0) > 0) {
    res.status(400).json({ error: 'Seules les commandes non réceptionnées et sans règlement peuvent être annulées.' }); return;
  }
  db.prepare("UPDATE purchases SET status='cancelled' WHERE id=?").run(id);
  logAudit(req.user!, 'CANCEL', 'purchase', purchase.po_number, purchase.status, 'cancelled');
  res.json({ ok: true, status: 'cancelled' });
});

router.post('/purchases/:id/receive', requireAuth, requirePermission('suppliers:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const pu = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as any;
  if (!pu) {
    res.status(404).json({ error: 'Bon de commande introuvable.' });
    return;
  }
  if (pu.status === 'cancelled') {
    res.status(400).json({ error: 'Ce bon de commande est annulé et ne peut plus être réceptionné.' });
    return;
  }
  if (pu.status === 'received' || pu.status === 'paid') {
    res.status(400).json({ error: 'Ce bon de commande a déjà été réceptionné en stock.' });
    return;
  }
  const lines = db.prepare('SELECT * FROM purchase_lines WHERE purchase_id = ?').all(id) as any[];
  db.transaction(() => {
    db.prepare("UPDATE purchases SET status='received' WHERE id=?").run(id);
    for (const l of lines) {
      if (l.material_id) {
        db.prepare('UPDATE materials SET current_quantity = current_quantity + ?, purchase_price = ? WHERE id = ?').run(
          l.quantity,
          l.unit_price,
          l.material_id
        );
        db.prepare(
          `INSERT INTO stock_movements (movement_type, material_id, quantity, unit_cost, total_cost, supplier_id, from_location, to_location, reference, movement_date, user_id)
           VALUES ('entry', ?, ?, ?, ?, ?, 'Fournisseur', 'Dépôt principal', ?, ?, ?)`
        ).run(l.material_id, l.quantity, l.unit_price, round2(l.quantity * l.unit_price), pu.supplier_id, pu.po_number, new Date().toISOString().slice(0, 10), req.user!.id);
      }
    }
  })();
  logAudit(req.user!, 'RECEIVE', 'purchase', pu.po_number, pu.status, 'received');
  res.json({ ok: true });
});

router.post('/purchases/:id/payments', requireAuth, requirePermission('suppliers:pay'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const amount = round2(Number(b.amount || 0));
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'Montant invalide.' });
    return;
  }
  const db = getDb();
  const pu = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id) as any;
  if (!pu) {
    res.status(404).json({ error: 'Achat introuvable.' });
    return;
  }
  if (pu.status === 'cancelled') {
    res.status(400).json({ error: 'Un bon de commande annulé ne peut plus recevoir de paiement.' });
    return;
  }
  const rem = round2(pu.total_ttc - pu.amount_paid);
  if (amount > rem + 0.01) {
    res.status(400).json({ error: `Le paiement (${amount} DA) dépasse le solde dû (${rem} DA).` });
    return;
  }
  const payDate = b.payment_date || new Date().toISOString().slice(0, 10);
  const method = b.payment_method || 'Virement';
  const recNo = `PAY-FRN-${Date.now().toString().slice(-5)}`;

  db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO payments (receipt_number, direction, supplier_id, purchase_id, payment_date, amount, payment_method, reference, notes, user_id)
         VALUES (?, 'outflow', ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(recNo, pu.supplier_id, id, payDate, amount, method, b.reference || '', b.notes || `Règlement ${pu.po_number}`, req.user!.id);

    const newPaid = round2(pu.amount_paid + amount);
    const newStatus = newPaid >= pu.total_ttc - 0.01 ? 'paid' : 'partial_paid';
    db.prepare('UPDATE purchases SET amount_paid=?, status=? WHERE id=?').run(newPaid, newStatus, id);

    const account = method === 'Espèces' ? 'Caisse' : 'Banque';
    const txType = method === 'Espèces' ? 'cash_outflow' : 'bank_outflow';
    db.prepare(
      `INSERT INTO treasury_transactions (tx_date, tx_type, account, category, amount, payment_method, project_id, supplier_id, linked_payment_id, notes, user_id)
       VALUES (?, ?, ?, 'Règlement fournisseur', ?, ?, ?, ?, ?, ?, ?)`
    ).run(payDate, txType, account, amount, method, pu.project_id, pu.supplier_id, info.lastInsertRowid, `${recNo} — ${pu.po_number}`, req.user!.id);
  })();

  logAudit(req.user!, 'PAYMENT', 'purchase', pu.po_number, `${pu.amount_paid}`, `+${amount} DA`);
  res.json({ ok: true });
});

// ==================== FLEET, FUEL, REPAIRS, MAINTENANCE & TOOLS ====================
router.get('/vehicles', requireAuth, requirePermission('vehicles:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT v.*, w.full_name AS driver_name, p.project_number, p.title AS project_title,
         (SELECT COALESCE(SUM(total_cost), 0) FROM repair_orders ro WHERE ro.vehicle_id = v.id) AS total_repair_cost,
         (SELECT COALESCE(SUM(total_cost), 0) FROM fuel_entries fe WHERE fe.vehicle_id = v.id) AS total_fuel_cost
       FROM vehicles v
       LEFT JOIN workers w ON w.id = v.driver_worker_id
       LEFT JOIN projects p ON p.id = v.current_project_id
       ORDER BY v.id ASC`
    )
    .all();
  res.json(rows);
});

router.post('/vehicles', requireAuth, requirePermission('vehicles:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.name?.trim() || !b.registration?.trim()) {
    res.status(400).json({ error: 'Désignation et immatriculation/code sont obligatoires.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO vehicles (asset_type, name, brand, registration, driver_worker_id, current_mileage, current_engine_hours, usage_rate_per_day, status, current_project_id, insurance_expiry, inspection_expiry, notes, lifecycle_status, deletion_eligible_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', datetime('now', '+7 days'))`
    )
    .run(
      b.asset_type || 'vehicle',
      b.name.trim(),
      b.brand || '',
      b.registration.trim(),
      b.driver_worker_id ? Number(b.driver_worker_id) : null,
      Number(b.current_mileage || 0),
      Number(b.current_engine_hours || 0),
      Number(b.usage_rate_per_day || 0),
      b.status || 'available',
      b.current_project_id ? Number(b.current_project_id) : null,
      b.insurance_expiry || null,
      b.inspection_expiry || null,
      b.notes || ''
    );
  logAudit(req.user!, 'CREATE', 'vehicle', b.registration.trim(), '', b.name.trim());
  res.status(201).json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/vehicles/:id', requireAuth, requirePermission('vehicles:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  if (!Number.isInteger(id) || id <= 0 || !b.name?.trim() || !b.registration?.trim()) {
    res.status(400).json({ error: 'Désignation et immatriculation/code sont obligatoires.' });
    return;
  }
  const db = getDb();
  const current = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as any;
  if (!current) { res.status(404).json({ error: 'Véhicule introuvable.' }); return; }
  const mileage = Number(b.current_mileage ?? current.current_mileage ?? 0);
  const engineHours = Number(b.current_engine_hours ?? current.current_engine_hours ?? 0);
  const usageRate = Number(b.usage_rate_per_day ?? current.usage_rate_per_day ?? 0);
  const assetType = String(b.asset_type || current.asset_type || 'vehicle');
  const status = String(b.status || current.status || 'available');
  if (![mileage, engineHours, usageRate].every(Number.isFinite) || [mileage, engineHours, usageRate].some(v => v < 0)) {
    res.status(400).json({ error: 'Les relevés et coûts d’utilisation doivent être des nombres positifs ou nuls.' }); return;
  }
  if (!['vehicle','truck','excavator','mixer','compressor','pump','scaffolding'].includes(assetType) ||
      !['available','on_project','under_maintenance','broken_down'].includes(status)) {
    res.status(400).json({ error: 'Type ou statut de véhicule invalide.' }); return;
  }
  try {
    db.prepare(`UPDATE vehicles SET asset_type = ?, name = ?, brand = ?, registration = ?, driver_worker_id = ?, current_mileage = ?, current_engine_hours = ?, usage_rate_per_day = ?, status = ?, current_project_id = ?, insurance_expiry = ?, inspection_expiry = ?, notes = ? WHERE id = ?`).run(
      assetType, b.name.trim(), b.brand ?? current.brand, b.registration.trim(),
      b.driver_worker_id ? Number(b.driver_worker_id) : null, mileage, engineHours, usageRate,
      status, b.current_project_id ? Number(b.current_project_id) : null,
      b.insurance_expiry || null, b.inspection_expiry || null, b.notes ?? current.notes, id
    );
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE')) { res.status(409).json({ error: 'Cette immatriculation existe déjà.' }); return; }
    throw error;
  }
  logAudit(req.user!, 'UPDATE', 'vehicle', id, current.name, b.name.trim());
  res.json(db.prepare('SELECT * FROM vehicles WHERE id = ?').get(id));
});

router.get('/fuel-entries', requireAuth, requirePermission('vehicles:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT f.*, v.name AS vehicle_name, v.registration, w.full_name AS driver_name, p.project_number, p.title AS project_title
       FROM fuel_entries f
       JOIN vehicles v ON v.id = f.vehicle_id
       LEFT JOIN workers w ON w.id = f.driver_worker_id
       LEFT JOIN projects p ON p.id = f.project_id
       ORDER BY f.date DESC, f.id DESC`
    )
    .all() as any[];

  const enriched = rows.map((r) => {
    const dist = r.odometer_after > r.odometer_before ? r.odometer_after - r.odometer_before : 0;
    const lPer100 = dist > 0 ? round2((r.liters / dist) * 100) : null;
    const abnormal = lPer100 !== null && lPer100 > 35;
    return { ...r, distance_km: dist, l_per_100: lPer100, abnormal };
  });
  res.json(enriched);
});

router.put('/fuel-entries/:id', requireAuth, requirePermission('fuel:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM fuel_entries WHERE id=?').get(id) as any;
  if (!old) { res.status(404).json({ error: 'Enregistrement carburant introuvable.' }); return; }
  const liters = Number(b.liters ?? old.liters);
  const pricePerLiter = Number(b.price_per_liter ?? old.price_per_liter);
  const odometerBefore = Number(b.odometer_before ?? old.odometer_before);
  const odometerAfter = Number(b.odometer_after ?? old.odometer_after);
  const entryDate = String(b.date || old.date);
  if (!Number.isFinite(liters) || liters <= 0 || !Number.isFinite(pricePerLiter) || pricePerLiter <= 0 ||
      !Number.isFinite(odometerBefore) || odometerBefore < 0 || !Number.isFinite(odometerAfter) || odometerAfter < 0 ||
      (odometerBefore > 0 && odometerAfter > 0 && odometerAfter < odometerBefore) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(entryDate) || !Number.isFinite(Date.parse(entryDate + 'T00:00:00'))) {
    res.status(400).json({ error: 'Vérifiez la date, les litres, le prix et les relevés kilométriques.' }); return;
  }
  const vehicleId = b.vehicle_id ? Number(b.vehicle_id) : Number(old.vehicle_id);
  const vehicle = db.prepare('SELECT id FROM vehicles WHERE id=?').get(vehicleId);
  if (!Number.isInteger(vehicleId) || !vehicle) {
    res.status(400).json({ error: 'Veuillez sélectionner un véhicule valide.' }); return;
  }
  const totalCost = round2(liters * pricePerLiter);
  db.transaction(() => {
    db.prepare(`UPDATE fuel_entries SET date=?, vehicle_id=?, liters=?, price_per_liter=?, total_cost=?, odometer_before=?, odometer_after=?, driver_worker_id=?, project_id=?, trip_purpose=?, fuel_station=?, notes=? WHERE id=?`).run(
      entryDate, vehicleId, liters, pricePerLiter, totalCost, odometerBefore, odometerAfter,
      b.driver_worker_id !== undefined ? (b.driver_worker_id ? Number(b.driver_worker_id) : null) : old.driver_worker_id,
      b.project_id ? Number(b.project_id) : null,
      b.trip_purpose ?? old.trip_purpose, b.fuel_station ?? old.fuel_station,
      b.notes ?? old.notes, id
    );
    if (odometerAfter > 0) db.prepare('UPDATE vehicles SET current_mileage=MAX(current_mileage,?) WHERE id=?').run(odometerAfter, vehicleId);
  })();
  logAudit(req.user!, 'UPDATE', 'fuel_entry', id, `${old.liters} L / ${old.total_cost} DA`, `${liters} L / ${totalCost} DA`);
  res.json(db.prepare('SELECT * FROM fuel_entries WHERE id=?').get(id));
});

router.post('/fuel-entries', requireAuth, requirePermission('fuel:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const vehicleId = Number(b.vehicle_id);
  const liters = Number(b.liters || 0);
  const ppl = Number(b.price_per_liter || 29.01);
  if (!vehicleId || liters <= 0) {
    res.status(400).json({ error: 'Véhicule et quantité de carburant (litres > 0) sont obligatoires.' });
    return;
  }
  const totalCost = round2(liters * ppl);
  const db = getDb();
  const id = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO fuel_entries (date, vehicle_id, driver_worker_id, liters, price_per_liter, total_cost, odometer_before, odometer_after, project_id, trip_purpose, fuel_station, notes, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        b.date || new Date().toISOString().slice(0, 10),
        vehicleId,
        b.driver_worker_id ? Number(b.driver_worker_id) : null,
        liters,
        ppl,
        totalCost,
        Number(b.odometer_before || 0),
        Number(b.odometer_after || 0),
        b.project_id ? Number(b.project_id) : null,
        b.trip_purpose || '',
        b.fuel_station || 'Naftal',
        b.notes || '',
        req.user!.id
      );
    if (Number(b.odometer_after || 0) > 0) {
      db.prepare('UPDATE vehicles SET current_mileage = MAX(current_mileage, ?) WHERE id = ?').run(
        Number(b.odometer_after),
        vehicleId
      );
    }
    return info.lastInsertRowid;
  })();
  logAudit(req.user!, 'CREATE', 'fuel_entry', id, '', `${liters} L — ${totalCost} DA`);
  res.status(201).json(db.prepare('SELECT * FROM fuel_entries WHERE id = ?').get(id));
});

router.get('/repair-orders', requireAuth, requirePermission('vehicles:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ro.*, v.name AS vehicle_name, v.registration, p.project_number
       FROM repair_orders ro
       JOIN vehicles v ON v.id = ro.vehicle_id
       LEFT JOIN projects p ON p.id = ro.project_id
       ORDER BY ro.repair_date DESC, ro.id DESC`
    )
    .all();
  res.json(rows);
});

router.post('/repair-orders', requireAuth, requirePermission('repairs:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.vehicle_id || !b.description?.trim()) {
    res.status(400).json({ error: 'Véhicule et description de la panne/intervention sont obligatoires.' });
    return;
  }
  const db = getDb();
  const parts = Number(b.parts_cost || 0);
  const labor = Number(b.labor_cost || 0);
  const towing = Number(b.towing_cost || 0);
  const total = round2(parts + labor + towing);
  let orderNumber = '';

  const id = db.transaction(() => {
    orderNumber = generateNextNumber('OR', 'repair_orders', 'order_number');
    const info = db
      .prepare(
        `INSERT INTO repair_orders (order_number, vehicle_id, repair_date, problem_category, description, priority, workshop, parts_used, parts_cost, labor_cost, towing_cost, total_cost, downtime_days, status, project_id, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        orderNumber,
        Number(b.vehicle_id),
        b.repair_date || new Date().toISOString().slice(0, 10),
        b.problem_category || 'other',
        b.description.trim(),
        b.priority || 'normal',
        b.workshop || '',
        b.parts_used || '',
        parts,
        labor,
        towing,
        total,
        Number(b.downtime_days || 0),
        b.status || 'waiting',
        b.project_id ? Number(b.project_id) : null,
        b.notes || ''
      );
    if (b.status !== 'completed') {
      db.prepare("UPDATE vehicles SET status='under_maintenance' WHERE id=?").run(Number(b.vehicle_id));
    }
    return info.lastInsertRowid;
  })();

  logAudit(req.user!, 'CREATE', 'repair_order', orderNumber, '', `${total} DA`);
  res.status(201).json(db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id));
});

router.put('/repair-orders/:id', requireAuth, requirePermission('repairs:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id) as any;
  if (!old) { res.status(404).json({ error: 'Ordre de réparation introuvable.' }); return; }
  const description = String(b.description ?? old.description).trim();
  const status = String(b.status ?? old.status);
  const parts = Number(b.parts_cost ?? old.parts_cost ?? 0);
  const labor = Number(b.labor_cost ?? old.labor_cost ?? 0);
  const towing = Number(b.towing_cost ?? old.towing_cost ?? 0);
  const downtime = Number(b.downtime_days ?? old.downtime_days ?? 0);
  const repairDate = String(b.repair_date ?? old.repair_date);
  if (!description || !['waiting','in_progress','completed'].includes(status) ||
      ![parts,labor,towing,downtime].every(Number.isFinite) || [parts,labor,towing,downtime].some(v=>v<0) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(repairDate) || !Number.isFinite(Date.parse(repairDate+'T00:00:00'))) {
    res.status(400).json({ error: 'Vérifiez la description, le statut, la date et les coûts de réparation.' }); return;
  }
  const total = round2(parts + labor + towing);
  db.transaction(() => {
    db.prepare(`UPDATE repair_orders SET repair_date=?, problem_category=?, description=?, priority=?, workshop=?, parts_used=?, parts_cost=?, labor_cost=?, towing_cost=?, total_cost=?, downtime_days=?, status=?, project_id=?, notes=? WHERE id=?`).run(
      repairDate, b.problem_category ?? old.problem_category, description, b.priority ?? old.priority,
      b.workshop ?? old.workshop, b.parts_used ?? old.parts_used, parts, labor, towing, total,
      downtime, status, b.project_id !== undefined ? (b.project_id ? Number(b.project_id) : null) : old.project_id,
      b.notes ?? old.notes, id
    );
    const openOrders = db.prepare("SELECT COUNT(*) AS count FROM repair_orders WHERE vehicle_id=? AND id<>? AND status<>'completed'").get(old.vehicle_id,id) as any;
    if (status === 'completed' && Number(openOrders.count) === 0) {
      db.prepare("UPDATE vehicles SET status=CASE WHEN current_project_id IS NOT NULL THEN 'on_project' ELSE 'available' END WHERE id=? AND status IN ('under_maintenance','broken_down')").run(old.vehicle_id);
    } else {
      db.prepare("UPDATE vehicles SET status='under_maintenance' WHERE id=? AND status IN ('available','on_project','under_maintenance','broken_down')").run(old.vehicle_id);
    }
  })();
  logAudit(req.user!, 'UPDATE', 'repair_order', old.order_number, `${old.status}: ${old.total_cost} DA`, `${status}: ${total} DA`);
  res.json(db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(id));
});

router.get('/maintenance-rules', requireAuth, requirePermission('vehicles:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT mr.*, v.name AS vehicle_name, v.registration, v.current_mileage, v.current_engine_hours
       FROM maintenance_rules mr JOIN vehicles v ON v.id = mr.vehicle_id ORDER BY mr.id ASC`
    )
    .all() as any[];

  const enriched = rows.map((r) => {
    const current = r.trigger_type === 'km' ? r.current_mileage : r.current_engine_hours;
    const remaining = r.next_due_value - current;
    const alert = remaining <= r.interval_value * 0.1;
    return { ...r, current_value: current, remaining_value: remaining, alert };
  });
  res.json(enriched);
});

router.post('/maintenance-rules/:id/create-order', requireAuth, requirePermission('repairs:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const rule = db.prepare('SELECT * FROM maintenance_rules WHERE id = ?').get(id) as any;
  if (!rule) {
    res.status(404).json({ error: 'Règle de maintenance introuvable.' });
    return;
  }
  let orderNumber = '';
  const roId = db.transaction(() => {
    orderNumber = generateNextNumber('OR', 'repair_orders', 'order_number');
    const info = db
      .prepare(
        `INSERT INTO repair_orders (order_number, vehicle_id, repair_date, problem_category, description, priority, status, notes)
         VALUES (?, ?, ?, 'other', ?, 'normal', 'waiting', 'Généré depuis maintenance préventive')`
      )
      .run(orderNumber, rule.vehicle_id, new Date().toISOString().slice(0, 10), `Maintenance préventive : ${rule.rule_name}`);
    db.prepare('UPDATE maintenance_rules SET last_done_value=next_due_value, next_due_value=next_due_value + interval_value WHERE id=?').run(id);
    return info.lastInsertRowid;
  })();
  logAudit(req.user!, 'CREATE', 'repair_order', orderNumber, '', rule.rule_name);
  res.status(201).json(db.prepare('SELECT * FROM repair_orders WHERE id = ?').get(roId));
});

router.get('/tools', requireAuth, requirePermission('vehicles:read'), (_req, res) => {
  const db = getDb();
  const tools = db
    .prepare(
      `SELECT t.*, w.full_name AS worker_name, p.project_number, p.title AS project_title
       FROM tools t
       LEFT JOIN workers w ON w.id = t.assigned_worker_id
       LEFT JOIN projects p ON p.id = t.assigned_project_id
       ORDER BY t.name ASC`
    )
    .all();
  res.json(tools);
});

router.get('/tools/checkouts', requireAuth, requirePermission('vehicles:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT tc.*, t.name AS tool_name, t.code AS tool_code, w.full_name AS worker_name, p.project_number
       FROM tool_checkouts tc
       JOIN tools t ON t.id = tc.tool_id
       LEFT JOIN workers w ON w.id = tc.worker_id
       LEFT JOIN projects p ON p.id = tc.project_id
       ORDER BY tc.id DESC LIMIT 50`
    )
    .all();
  res.json(rows);
});

router.post('/tools/checkout', requireAuth, requirePermission('materials:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const toolId = Number(b.tool_id);
  if (!toolId || !b.worker_id) {
    res.status(400).json({ error: 'Outil et ouvrier responsable sont obligatoires.' });
    return;
  }
  const db = getDb();
  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId) as any;
  if (!tool || tool.status !== 'available') {
    res.status(400).json({ error: 'Outil introuvable ou déjà affecté.' });
    return;
  }
  db.transaction(() => {
    db.prepare(
      `INSERT INTO tool_checkouts (tool_id, action_type, worker_id, project_id, issued_date, expected_return_date, condition_out, notes, user_id)
       VALUES (?, 'checkout', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      toolId,
      Number(b.worker_id),
      b.project_id ? Number(b.project_id) : null,
      b.issued_date || new Date().toISOString().slice(0, 10),
      b.expected_return_date || null,
      tool.condition,
      b.notes || '',
      req.user!.id
    );
    db.prepare("UPDATE tools SET status='assigned', assigned_worker_id=?, assigned_project_id=? WHERE id=?").run(
      Number(b.worker_id),
      b.project_id ? Number(b.project_id) : null,
      toolId
    );
  })();
  logAudit(req.user!, 'CHECKOUT', 'tool', tool.code, 'available', 'assigned');
  res.json({ ok: true });
});

router.post('/tools/return', requireAuth, requirePermission('materials:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const toolId = Number(b.tool_id);
  const db = getDb();
  const tool = db.prepare('SELECT * FROM tools WHERE id = ?').get(toolId) as any;
  if (!tool) {
    res.status(404).json({ error: 'Outil introuvable.' });
    return;
  }
  const condIn = b.condition_in || 'good';
  const nextStatus = condIn === 'damaged' ? 'under_repair' : condIn === 'lost' ? 'lost' : 'available';
  db.transaction(() => {
    db.prepare(
      `INSERT INTO tool_checkouts (tool_id, action_type, worker_id, project_id, issued_date, actual_return_date, condition_in, notes, user_id)
       VALUES (?, 'return', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      toolId,
      tool.assigned_worker_id,
      tool.assigned_project_id,
      new Date().toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10),
      condIn,
      b.notes || 'Retour dépôt',
      req.user!.id
    );
    db.prepare("UPDATE tools SET status=?, condition=?, assigned_worker_id=NULL, assigned_project_id=NULL, storage_location='Dépôt principal' WHERE id=?").run(
      nextStatus,
      condIn,
      toolId
    );
  })();
  logAudit(req.user!, 'RETURN', 'tool', tool.code, tool.status, nextStatus);
  res.json({ ok: true });
});

// ==================== TREASURY, CASH CLOSING & EXPENSES ====================
router.get('/treasury', requireAuth, requirePermission('treasury:read'), (_req, res) => {
  const db = getDb();
  const transactions = db
    .prepare(
      `SELECT t.*, p.project_number, c.name AS client_name, s.name AS supplier_name
       FROM treasury_transactions t
       LEFT JOIN projects p ON p.id = t.project_id
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN suppliers s ON s.id = t.supplier_id
       ORDER BY t.tx_date DESC, t.id DESC`
    )
    .all() as any[];

  let cashBalance = 0;
  let bankBalance = 0;
  for (const t of transactions) {
    if (t.tx_type === 'cash_inflow') cashBalance += t.amount;
    else if (t.tx_type === 'cash_outflow' || t.tx_type === 'advance') cashBalance -= t.amount;
    else if (t.tx_type === 'bank_inflow') bankBalance += t.amount;
    else if (t.tx_type === 'bank_outflow') bankBalance -= t.amount;
    else if (t.tx_type === 'internal_transfer') {
      if (t.account === 'Banque' && t.to_account === 'Caisse') {
        bankBalance -= t.amount;
        cashBalance += t.amount;
      } else if (t.account === 'Caisse' && t.to_account === 'Banque') {
        cashBalance -= t.amount;
        bankBalance += t.amount;
      }
    }
  }

  const closings = db
    .prepare('SELECT cc.*, u.name AS closed_by_name FROM cash_closings cc LEFT JOIN users u ON u.id = cc.closed_by ORDER BY closing_date DESC')
    .all();

  res.json({
    cashBalance: round2(cashBalance),
    bankBalance: round2(bankBalance),
    totalLiquid: round2(cashBalance + bankBalance),
    transactions,
    closings,
  });
});

router.post('/treasury/transactions', requireAuth, requirePermission('treasury:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const amount = round2(Number(b.amount || 0));
  if (amount <= 0) {
    res.status(400).json({ error: 'Le montant doit être supérieur à 0 DA.' });
    return;
  }
  const db = getDb();
  const txType = b.tx_type || 'cash_inflow';
  const account = txType.startsWith('bank') || b.account === 'Banque' ? 'Banque' : 'Caisse';
  const toAccount = txType === 'internal_transfer' ? (account === 'Banque' ? 'Caisse' : 'Banque') : null;

  const info = db
    .prepare(
      `INSERT INTO treasury_transactions (tx_date, tx_type, account, to_account, category, amount, payment_method, project_id, notes, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      b.tx_date || new Date().toISOString().slice(0, 10),
      txType,
      account,
      toAccount,
      b.category || (txType === 'internal_transfer' ? 'Transfert interne' : 'Opération trésorerie'),
      amount,
      b.payment_method || (account === 'Banque' ? 'Virement' : 'Espèces'),
      b.project_id ? Number(b.project_id) : null,
      b.notes || '',
      req.user!.id
    );
  logAudit(req.user!, 'CREATE', 'treasury', info.lastInsertRowid, '', `${txType}: ${amount} DA`);
  res.status(201).json(db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(info.lastInsertRowid));
});

router.post('/treasury/transactions/:id/reverse', requireAuth, requirePermission('treasury:write'), requirePermission('lifecycle:reverse'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const { reason } = req.body || {};
  const db = getDb();
  const orig = db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(id) as any;
  if (!orig) { res.status(404).json({ error: 'Transaction introuvable.' }); return; }
  if (orig.status === 'reversed') { res.status(400).json({ error: 'Cette transaction est déjà contre-passée.' }); return; }
  if (orig.reversed_transaction_id) { res.status(400).json({ error: 'Cette transaction a déjà fait l’objet d’une contre-passation.' }); return; }

  let revType = orig.tx_type;
  if (orig.tx_type === 'cash_inflow') revType = 'cash_outflow';
  else if (orig.tx_type === 'cash_outflow') revType = 'cash_inflow';
  else if (orig.tx_type === 'bank_inflow') revType = 'bank_outflow';
  else if (orig.tx_type === 'bank_outflow') revType = 'bank_inflow';
  const revAccount = orig.tx_type === 'internal_transfer' ? orig.to_account : orig.account;
  const revToAccount = orig.tx_type === 'internal_transfer' ? orig.account : orig.to_account;

  const newId = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO treasury_transactions (tx_date, tx_type, account, to_account, category, amount, payment_method, project_id, notes, user_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      )
      .run(
        new Date().toISOString().slice(0, 10),
        revType,
        revAccount,
        revToAccount,
        'Contre-passation',
        orig.amount,
        orig.payment_method,
        orig.project_id,
        reason || `Contre-passation de la transaction #${id}`,
        req.user!.id
      );
    const nid = Number(info.lastInsertRowid);
    db.prepare("UPDATE treasury_transactions SET status='reversed', reversed_transaction_id=? WHERE id=?").run(nid, id);
    db.prepare('UPDATE treasury_transactions SET reversed_transaction_id=? WHERE id=?').run(id, nid);
    return nid;
  })();

  logAudit(req.user!, 'REVERSE', 'treasury', id, orig.tx_type, `Contre-passée par #${newId}`);
  res.status(201).json(db.prepare('SELECT * FROM treasury_transactions WHERE id = ?').get(newId));
});

router.post('/treasury/reconcile', requireAuth, requirePermission('treasury:write'), (req: AuthedRequest, res) => {
  const { id, bank_statement_ref, reconciled } = req.body || {};
  const db = getDb();
  db.prepare('UPDATE treasury_transactions SET bank_reconciled=?, bank_statement_ref=? WHERE id=?').run(
    reconciled ? 1 : 0,
    bank_statement_ref || '',
    Number(id)
  );
  logAudit(req.user!, 'RECONCILE', 'treasury', id, '', bank_statement_ref || '');
  res.json({ ok: true });
});

router.post('/treasury/cash-closings', requireAuth, requirePermission('treasury:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const closingDate = b.closing_date || new Date().toISOString().slice(0, 10);
  const counted = round2(Number(b.counted_balance || 0));
  const db = getDb();

  // Compute expected cash balance up to closingDate
  const rows = db
    .prepare("SELECT tx_type, account, to_account, amount, tx_date FROM treasury_transactions WHERE tx_date <= ?")
    .all(closingDate) as any[];
  let expected = 0;
  let dayIn = 0;
  let dayOut = 0;
  for (const r of rows) {
    let delta = 0;
    if (r.tx_type === 'cash_inflow') delta = r.amount;
    else if (r.tx_type === 'cash_outflow' || r.tx_type === 'advance') delta = -r.amount;
    else if (r.tx_type === 'internal_transfer' && r.to_account === 'Caisse') delta = r.amount;
    else if (r.tx_type === 'internal_transfer' && r.account === 'Caisse') delta = -r.amount;
    expected += delta;
    if (r.tx_date === closingDate) {
      if (delta > 0) dayIn += delta;
      if (delta < 0) dayOut += Math.abs(delta);
    }
  }
  expected = round2(expected);
  const opening = round2(expected - dayIn + dayOut);
  const diff = round2(counted - expected);

  db.prepare(
    `INSERT INTO cash_closings (closing_date, opening_balance, cash_inflows, cash_outflows, expected_closing, counted_balance, difference, notes, closed_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(closing_date) DO UPDATE SET
       expected_closing=excluded.expected_closing, counted_balance=excluded.counted_balance, difference=excluded.difference, notes=excluded.notes, closed_by=excluded.closed_by`
  ).run(closingDate, opening, round2(dayIn), round2(dayOut), expected, counted, diff, b.notes || '', req.user!.id);

  logAudit(req.user!, 'CASH_CLOSE', 'cash_closing', closingDate, `Théorique ${expected}`, `Compté ${counted} (Écart ${diff})`);
  res.json({ closing_date: closingDate, expected_closing: expected, counted_balance: counted, difference: diff });
});

router.get('/expenses', requireAuth, requirePermission('expenses:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT e.*, p.project_number, p.title AS project_title, v.name AS vehicle_name
       FROM expenses e
       LEFT JOIN projects p ON p.id = e.project_id
       LEFT JOIN vehicles v ON v.id = e.vehicle_id
       ORDER BY e.expense_date DESC, e.id DESC`
    )
    .all();
  res.json(rows);
});

router.put('/expenses/:id', requireAuth, requirePermission('expenses:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const amount = round2(Number(b.amount || 0));
  if (!Number.isInteger(id) || id <= 0 || !b.category || !String(b.description || '').trim() || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: 'Date, catégorie, libellé et montant valide (> 0) sont obligatoires.' }); return;
  }
  const db = getDb();
  const old = db.prepare('SELECT * FROM expenses WHERE id=?').get(id) as any;
  if (!old) { res.status(404).json({ error: 'Dépense introuvable.' }); return; }
  const linked = db.prepare('SELECT * FROM treasury_transactions WHERE linked_expense_id=?').get(id) as any;
  if (linked?.bank_reconciled) {
    res.status(400).json({ error: 'Cette dépense est déjà rapprochée avec un relevé bancaire. Créez une opération de régularisation au lieu de modifier l’historique.' }); return;
  }
  const expDate = String(b.expense_date || old.expense_date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expDate) || !Number.isFinite(Date.parse(expDate + 'T00:00:00'))) {
    res.status(400).json({ error: 'Date de dépense invalide.' }); return;
  }
  const method = String(b.payment_method || old.payment_method || 'Espèces');
  if (!['Espèces','Virement','Chèque'].includes(method)) {
    res.status(400).json({ error: 'Mode de paiement invalide.' }); return;
  }
  const projectId = b.project_id ? Number(b.project_id) : null;
  const vehicleId = b.vehicle_id ? Number(b.vehicle_id) : null;
  const account = method === 'Espèces' ? 'Caisse' : 'Banque';
  const txType = method === 'Espèces' ? 'cash_outflow' : 'bank_outflow';
  db.transaction(() => {
    db.prepare(`UPDATE expenses SET expense_date=?, category=?, description=?, amount=?, payment_method=?, project_id=?, vehicle_id=?, is_overhead=?, notes=? WHERE id=?`).run(
      expDate, String(b.category), String(b.description).trim(), amount, method, projectId, vehicleId,
      b.is_overhead || !projectId ? 1 : 0, b.notes || '', id
    );
    if (linked) {
      db.prepare(`UPDATE treasury_transactions SET tx_date=?, tx_type=?, account=?, to_account=NULL, category=?, amount=?, payment_method=?, project_id=?, notes=? WHERE id=?`).run(
        expDate, txType, account, String(b.category), amount, method, projectId,
        String(b.description).trim(), linked.id
      );
    }
  })();
  logAudit(req.user!, 'UPDATE', 'expense', id, `${old.category}: ${old.amount} DA`, `${b.category}: ${amount} DA`);
  res.json(db.prepare('SELECT * FROM expenses WHERE id=?').get(id));
});

router.post('/expenses/:id/cancel', requireAuth, requirePermission('expenses:write'), requirePermission('lifecycle:cancel'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Dépense introuvable.' }); return; }
  if (row.status === 'cancelled') { res.status(400).json({ error: 'Cette dépense est déjà annulée.' }); return; }
  const linked = db.prepare('SELECT * FROM treasury_transactions WHERE linked_expense_id = ?').get(id) as any;
  if (linked?.bank_reconciled) {
    res.status(400).json({ error: 'Cette dépense est déjà rapprochée. Créez une opération de régularisation.' }); return;
  }
  db.transaction(() => {
    db.prepare("UPDATE expenses SET status='cancelled' WHERE id = ?").run(id);
    if (linked && linked.status !== 'reversed') {
      const revType = linked.tx_type === 'cash_outflow' ? 'cash_inflow' : linked.tx_type === 'bank_outflow' ? 'bank_inflow' : linked.tx_type;
      const revAccount = linked.account;
      db.prepare(
        `INSERT INTO treasury_transactions (tx_date, tx_type, account, to_account, category, amount, payment_method, project_id, notes, user_id, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`
      ).run(
        new Date().toISOString().slice(0, 10), revType, revAccount, linked.to_account, 'Annulation dépense', linked.amount,
        linked.payment_method, linked.project_id, `Annulation dépense #${id}`, req.user!.id
      );
      db.prepare("UPDATE treasury_transactions SET status='reversed', reversed_transaction_id=? WHERE id=?").run(
        Number((db.prepare('SELECT last_insert_rowid() AS id').get() as any).id), linked.id
      );
    }
  })();
  logAudit(req.user!, 'CANCEL', 'expense', id, `${row.category}: ${row.amount} DA`, 'cancelled');
  res.json({ ok: true, status: 'cancelled' });
});

router.post('/expenses', requireAuth, requirePermission('expenses:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const amount = round2(Number(b.amount || 0));
  if (!b.category || !b.description?.trim() || amount <= 0) {
    res.status(400).json({ error: 'Catégorie, libellé et montant (> 0) sont obligatoires.' });
    return;
  }
  const db = getDb();
  const expDate = b.expense_date || new Date().toISOString().slice(0, 10);
  const method = b.payment_method || 'Espèces';
  const id = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO expenses (expense_date, category, description, amount, payment_method, project_id, vehicle_id, is_overhead, notes, user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        expDate,
        b.category,
        b.description.trim(),
        amount,
        method,
        b.project_id ? Number(b.project_id) : null,
        b.vehicle_id ? Number(b.vehicle_id) : null,
        b.is_overhead ? 1 : 0,
        b.notes || '',
        req.user!.id
      );

    const account = method === 'Espèces' ? 'Caisse' : 'Banque';
    const txType = method === 'Espèces' ? 'cash_outflow' : 'bank_outflow';
    db.prepare(
      `INSERT INTO treasury_transactions (tx_date, tx_type, account, category, amount, payment_method, project_id, linked_expense_id, notes, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(expDate, txType, account, b.category, amount, method, b.project_id ? Number(b.project_id) : null, info.lastInsertRowid, b.description.trim(), req.user!.id);

    return info.lastInsertRowid;
  })();
  logAudit(req.user!, 'CREATE', 'expense', id, '', `${b.category}: ${amount} DA`);
  res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(id));
});

// ==================== TAXES & ALGERIAN ACCOUNTING ====================
router.get('/taxes/summary', requireAuth, requirePermission('taxes:read'), (_req, res) => {
  const db = getDb();
  const rules = db.prepare('SELECT * FROM tax_rules ORDER BY id ASC').all();

  const salesRow = db
    .prepare(
      `SELECT
        COALESCE(SUM(CASE WHEN doc_type='facture' AND status NOT IN ('draft','cancelled') THEN total_ht
                          WHEN doc_type='avoir' AND status NOT IN ('draft','cancelled') THEN -total_ht ELSE 0 END), 0) AS ca_ht,
        COALESCE(SUM(CASE WHEN doc_type='facture' AND status NOT IN ('draft','cancelled') THEN total_tva
                          WHEN doc_type='avoir' AND status NOT IN ('draft','cancelled') THEN -total_tva ELSE 0 END), 0) AS tva_collectee
       FROM commercial_documents`
    )
    .get() as { ca_ht: number; tva_collectee: number };

  const purchRow = db
    .prepare("SELECT COALESCE(SUM(total_tva), 0) AS tva_deductible, COALESCE(SUM(total_ht), 0) AS achats_ht FROM purchases WHERE status != 'cancelled'")
    .get() as { tva_deductible: number; achats_ht: number };

  const payrollRow = db
    .prepare(
      `SELECT COALESCE(SUM(cnas_employee), 0) AS cnas_emp,
              COALESCE(SUM(cnas_employer), 0) AS cnas_pat,
              COALESCE(SUM(irg_amount), 0) AS irg_total
       FROM payslips`
    )
    .get() as { cnas_emp: number; cnas_pat: number; irg_total: number };

  const ibsRate = getTaxRate('IBS', 19);
  const tapRate = getTaxRate('TAP', 0);

  const expensesRow = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE status <> 'cancelled'").get() as { total: number };
  const grossProfit = Math.max(0, salesRow.ca_ht - purchRow.achats_ht - expensesRow.total);

  res.json({
    rules,
    indicators: {
      ca_ht: round2(salesRow.ca_ht),
      tva_collectee: round2(salesRow.tva_collectee),
      tva_deductible: round2(purchRow.tva_deductible),
      tva_a_payer: round2(Math.max(0, salesRow.tva_collectee - purchRow.tva_deductible)),
      cnas_employee: round2(payrollRow.cnas_emp),
      cnas_employer: round2(payrollRow.cnas_pat),
      cnas_total: round2(payrollRow.cnas_emp + payrollRow.cnas_pat),
      irg_salaires: round2(payrollRow.irg_total),
      tap_due: round2(salesRow.ca_ht * (tapRate / 100)),
      ibs_estime: round2(grossProfit * (ibsRate / 100)),
    },
  });
});

const TAX_RULE_CODE = /^[A-Z0-9_]{2,32}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(parsed.getTime())) return false;
  // Reject rolled-over calendar dates such as 2026-02-31, which Date.parse accepts.
  return parsed.toISOString().slice(0, 10) === value;
}

// IRG_BAREME holds the progressive bracket configuration (config_json), not a single rate.
const IRG_BAREME_CODE = 'IRG_BAREME';

function findActiveRuleWithSameCodeAndDate(code: string, effectiveDate: string, excludeId = 0): { id: number } | undefined {
  return getDb()
    .prepare(
      `SELECT id FROM tax_rules
       WHERE code = ? AND effective_date = ? AND status = 'active' AND id <> ?
       LIMIT 1`
    )
    .get(code, effectiveDate, excludeId) as { id: number } | undefined;
}

router.post('/taxes/rules', requireAuth, requirePermission('taxes:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  const name = String(b.name || '').trim();
  const rate = Number(b.rate);
  const effectiveDate = String(b.effective_date || new Date().toISOString().slice(0, 10));
  if (!TAX_RULE_CODE.test(code)) {
    res.status(400).json({ error: 'Le code doit contenir 2 à 32 caractères (lettres, chiffres ou tiret bas).' });
    return;
  }
  if (code === IRG_BAREME_CODE) {
    res.status(400).json({
      error: 'IRG_BAREME est un barème progressif : il se configure par tranches et ne peut pas être créé avec un taux simple.',
    });
    return;
  }
  if (!name) {
    res.status(400).json({ error: 'Le libellé de la règle fiscale est obligatoire.' });
    return;
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    res.status(400).json({ error: 'Le taux doit être un nombre compris entre 0 et 100.' });
    return;
  }
  if (!isValidIsoDate(effectiveDate)) {
    res.status(400).json({ error: 'La date d’effet est invalide.' });
    return;
  }
  const db = getDb();
  const insertRule = db.transaction(() => {
    if (findActiveRuleWithSameCodeAndDate(code, effectiveDate)) {
      throw new Error('DUPLICATE_ACTIVE_TAX_RULE');
    }
    return db
      .prepare(
        `INSERT INTO tax_rules (code, name, rate, config_json, effective_date, status, notes, validated_by)
         VALUES (?, ?, ?, '{}', ?, 'active', ?, ?)`
      )
      .run(code, name, round2(rate), effectiveDate, String(b.notes || ''), req.user!.name);
  });
  let info: { lastInsertRowid: number | bigint };
  try {
    info = insertRule.immediate();
  } catch (error: any) {
    if (error?.message === 'DUPLICATE_ACTIVE_TAX_RULE') {
      res.status(400).json({
        error: 'Une règle active avec ce code et cette date d’effet existe déjà. Archivez-la ou choisissez une autre date.',
      });
      return;
    }
    throw error;
  }
  logAudit(req.user!, 'CREATE', 'tax_rule', code, '', `${rate}%`);
  res.status(201).json(db.prepare('SELECT * FROM tax_rules WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/taxes/rules/:id', requireAuth, requirePermission('taxes:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM tax_rules WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Règle fiscale introuvable.' });
    return;
  }
  if (old.code === IRG_BAREME_CODE && b.rate !== undefined) {
    res.status(400).json({
      error: 'IRG_BAREME est un barème progressif : il se configure par tranches et ne peut pas être modifié par un taux unique.',
    });
    return;
  }
  const rate = b.rate !== undefined ? Number(b.rate) : Number(old.rate);
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    res.status(400).json({ error: 'Le taux doit être un nombre compris entre 0 et 100.' });
    return;
  }
  const effectiveDate = String(b.effective_date ?? old.effective_date);
  if (!isValidIsoDate(effectiveDate)) {
    res.status(400).json({ error: 'La date d’effet est invalide.' });
    return;
  }
  const name = b.name !== undefined ? String(b.name).trim() : old.name;
  if (!name) {
    res.status(400).json({ error: 'Le libellé de la règle fiscale est obligatoire.' });
    return;
  }
  const status = b.status !== undefined ? String(b.status) : old.status;
  if (!['active', 'archived'].includes(status)) {
    res.status(400).json({ error: 'Statut de règle fiscale invalide.' });
    return;
  }
  const applyUpdate = db.transaction(() => {
    if (status === 'active' && findActiveRuleWithSameCodeAndDate(old.code, effectiveDate, id)) {
      throw new Error('DUPLICATE_ACTIVE_TAX_RULE');
    }
    db.prepare('UPDATE tax_rules SET name=?, rate=?, notes=?, effective_date=?, status=?, validated_by=? WHERE id=?').run(
      name,
      round2(rate),
      b.notes ?? old.notes,
      effectiveDate,
      status,
      req.user!.name,
      id
    );
  });
  try {
    applyUpdate.immediate();
  } catch (error: any) {
    if (error?.message === 'DUPLICATE_ACTIVE_TAX_RULE') {
      res.status(400).json({
        error: 'Une règle active avec ce code et cette date d’effet existe déjà. Archivez-la ou choisissez une autre date.',
      });
      return;
    }
    throw error;
  }
  logAudit(req.user!, status === 'archived' && old.status !== 'archived' ? 'ARCHIVE' : 'UPDATE', 'tax_rule', old.code, `${old.rate}%`, `${rate}%`);
  res.json(db.prepare('SELECT * FROM tax_rules WHERE id = ?').get(id));
});

// Validate optional document links against an explicit allow-list of local entities.
function resolveDocumentRelation(typeValue: unknown, idValue: unknown) {
  const type = String(typeValue || '').trim();
  const id = idValue === '' || idValue === null || idValue === undefined ? null : Number(idValue);
  if (!type && id === null) return { type: '', id: null as number | null };
  const tables: Record<string, string> = {
    client: 'clients',
    project: 'projects',
    supplier: 'suppliers',
    worker: 'workers',
    site_report: 'site_reports',
    task: 'project_tasks',
  };
  const table = tables[type];
  if (!table || !Number.isSafeInteger(id) || Number(id) <= 0) throw new Error('La fiche associée est invalide.');
  const exists = getDb().prepare(`SELECT id FROM ${table} WHERE id = ?`).get(Number(id));
  if (!exists) throw new Error('La fiche associée est introuvable.');
  return { type, id: Number(id) };
}

// ==================== DOCUMENTS CENTER ====================
router.get('/documents', requireAuth, requirePermission('documents:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT d.*, u.name AS uploaded_by_name
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE d.archived = 0 ORDER BY d.doc_date DESC, d.id DESC`
    )
    .all();
  res.json(rows);
});

router.post('/documents', requireAuth, requirePermission('documents:write'), uploadMemory.single('file'), (req: AuthedRequest, res) => {
  const file = req.file;
  const b = req.body || {};
  const title = String(b.title || '').trim();
  const cat = String(b.category || 'General').trim();
  const docDate = String(b.doc_date || new Date().toISOString().slice(0, 10));
  const notes = String(b.notes || '');
  if (!file || !title || title.length > 180 || cat.length > 40 || notes.length > 1000 || !/^\d{4}-\d{2}-\d{2}$/.test(docDate)) {
    res.status(400).json({ error: 'Fichier, intitulé, catégorie, date ou notes invalides.' });
    return;
  }
  let relation: { type: string; id: number | null };
  try {
    relation = resolveDocumentRelation(b.related_type, b.related_id);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
    return;
  }
  const folderMap: Record<string, string> = {
    invoices: 'Invoices',
    projects: 'Projects',
    vehicles: 'Vehicles',
    payroll: 'Payroll',
    suppliers: 'Suppliers',
    contracts: 'Contracts',
    clients: 'Clients',
    equipment: 'Equipment',
  };
  const subDir = folderMap[cat.toLowerCase()] || 'General';
  const safeName = `${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const relPath = path.posix.join(subDir, safeName);
  const fullPath = path.join(DOCS_DIR, subDir, safeName);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, file.buffer);

  const db = getDb();
  const info = db
    .prepare(
      `INSERT INTO documents (title, category, file_name, stored_path, mime_type, file_size, doc_date, related_type, related_id, notes, uploaded_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      title,
      cat,
      file.originalname,
      relPath,
      file.mimetype,
      file.size,
      docDate,
      relation.type,
      relation.id,
      b.notes || '',
      req.user!.id
    );
  logAudit(req.user!, 'UPLOAD', 'document', info.lastInsertRowid, '', file.originalname);
  res.status(201).json(db.prepare('SELECT * FROM documents WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/documents/:id', requireAuth, requirePermission('documents:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Document introuvable.' });
    return;
  }
  const title = String(b.title ?? old.title).trim();
  const category = String(b.category ?? old.category).trim();
  const docDate = String(b.doc_date ?? old.doc_date);
  const notes = String(b.notes ?? old.notes ?? '');
  let relation: { type: string; id: number | null };
  try {
    relation = resolveDocumentRelation(b.related_type ?? old.related_type, b.related_id ?? old.related_id);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
    return;
  }
  if (!title || title.length > 180 || !/^\d{4}-\d{2}-\d{2}$/.test(docDate) || notes.length > 1000 || !category || category.length > 40) {
    res.status(400).json({ error: 'Intitulé, catégorie, date ou notes invalides.' });
    return;
  }
  db.prepare('UPDATE documents SET title=?, category=?, doc_date=?, related_type=?, related_id=?, notes=? WHERE id=?')
    .run(title, category, docDate, relation.type, relation.id, notes, id);
  logAudit(req.user!, 'UPDATE', 'document', id, old.title, title);
  res.json(db.prepare('SELECT * FROM documents WHERE id = ?').get(id));
});

router.get('/documents/export/xlsx', requireAuth, requirePermission('documents:read'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare(
    `SELECT d.title AS Intitule, d.category AS Categorie, d.file_name AS Fichier,
            d.mime_type AS Type_MIME, d.file_size AS Taille_octets, d.doc_date AS Date_document,
            d.related_type AS Type_fiche, d.related_id AS ID_fiche, d.notes AS Notes,
            u.name AS Depose_par, d.created_at AS Date_archivage
     FROM documents d LEFT JOIN users u ON u.id=d.uploaded_by
     WHERE d.archived=0 ORDER BY d.doc_date DESC, d.id DESC`
  ).all();
  sendXlsx(res, 'registre_documents_gestionpro.xlsx', [{ name: 'Documents', rows }]);
});

router.get('/documents/:id/download', requireAuth, requirePermission('documents:read'), (req, res) => {
  const db = getDb();
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(req.params.id)) as any;
  if (!doc) {
    res.status(404).json({ error: 'Document introuvable.' });
    return;
  }
  const fullPath = path.join(DOCS_DIR, doc.stored_path);
  if (!fs.existsSync(fullPath)) {
    res.status(404).json({ error: 'Fichier physique non présent sur le disque (document modèle démo).' });
    return;
  }
  res.download(fullPath, doc.file_name);
});

router.delete('/documents/:id', requireAuth, requirePermission('documents:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('UPDATE documents SET archived = 1 WHERE id = ?').run(id);
  logAudit(req.user!, 'ARCHIVE', 'document', id, '', 'Archivé');
  res.json({ ok: true });
});

// ==================== DEBTS & RECEIVABLES CONTROL ====================
router.get('/finance/debts', requireAuth, requirePermission('treasury:read'), (_req, res) => {
  const db = getDb();

  // Receivables are computed from issued invoices, net of recorded receipts
  // and linked credit notes. Draft/cancelled documents never create a debt.
  const receivables = db.prepare(
    `SELECT d.id, d.doc_number, d.client_id, c.name AS party_name,
            d.issue_date, d.due_date, d.total_ttc, d.amount_paid, d.status,
            COALESCE((SELECT SUM(a.total_ttc) FROM commercial_documents a
                      WHERE a.doc_type='avoir' AND a.linked_doc_id=d.id
                        AND a.status NOT IN ('draft','cancelled')), 0) AS credits_applied,
            MAX(0, d.total_ttc - d.amount_paid -
              COALESCE((SELECT SUM(a.total_ttc) FROM commercial_documents a
                        WHERE a.doc_type='avoir' AND a.linked_doc_id=d.id
                          AND a.status NOT IN ('draft','cancelled')), 0)) AS balance_due
     FROM commercial_documents d
     JOIN clients c ON c.id=d.client_id
     WHERE d.doc_type='facture' AND d.status NOT IN ('draft','cancelled')
     ORDER BY COALESCE(d.due_date,d.issue_date) ASC, d.id ASC`
  ).all() as any[];

  const payables = db.prepare(
    `SELECT pu.id, pu.po_number AS reference, pu.supplier_invoice_no, pu.supplier_id,
            s.name AS party_name, pu.order_date AS issue_date, pu.total_ttc,
            pu.amount_paid, pu.status,
            MAX(0, pu.total_ttc - pu.amount_paid) AS balance_due,
            pu.project_id, pr.project_number, pr.title AS project_title
     FROM purchases pu
     JOIN suppliers s ON s.id=pu.supplier_id
     LEFT JOIN projects pr ON pr.id=pu.project_id
     WHERE pu.status IN ('ordered','received','partial_paid','paid')
     ORDER BY pu.order_date ASC, pu.id ASC`
  ).all() as any[];

  const workerAdvances = db.prepare(
    `SELECT w.id AS worker_id, w.full_name AS party_name, w.job_title,
            COALESCE(SUM(a.advance_amount),0) AS advances_issued,
            COALESCE((SELECT SUM(ps.advances_deducted)
                      FROM payslips ps
                      JOIN payroll_periods pp ON pp.id=ps.payroll_period_id
                      WHERE ps.worker_id=w.id AND pp.status='approved'),0) AS advances_recovered
     FROM workers w
     LEFT JOIN attendance a ON a.worker_id=w.id AND a.approval_status='approved'
     GROUP BY w.id
     HAVING COALESCE(SUM(a.advance_amount),0) > 0
     ORDER BY w.full_name COLLATE NOCASE`
  ).all() as any[];

  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,10);
  const ageDays = (date: string | null) => {
    if (!date) return 0;
    const parsed = Date.parse(String(date).slice(0,10) + 'T00:00:00Z');
    return Number.isFinite(parsed) ? Math.max(0, Math.floor((Date.parse(today + 'T00:00:00Z') - parsed) / 86400000)) : 0;
  };
  for (const row of receivables) {
    row.balance_due = round2(Number(row.balance_due || 0));
    row.days_overdue = row.due_date && row.balance_due > 0 ? Math.max(0, ageDays(row.due_date) - 0) : 0;
    row.age_days = ageDays(row.issue_date);
  }
  for (const row of payables) {
    row.balance_due = round2(Number(row.balance_due || 0));
    row.age_days = ageDays(row.issue_date);
  }
  for (const row of workerAdvances) {
    row.advances_issued = round2(Number(row.advances_issued || 0));
    row.advances_recovered = round2(Number(row.advances_recovered || 0));
    row.balance_due = round2(Math.max(0, row.advances_issued - row.advances_recovered));
  }

  const totalReceivable = round2(receivables.reduce((sum, row) => sum + row.balance_due, 0));
  const totalPayable = round2(payables.reduce((sum, row) => sum + row.balance_due, 0));
  const totalWorkerAdvances = round2(workerAdvances.reduce((sum, row) => sum + row.balance_due, 0));
  res.json({
    as_of: today,
    summary: {
      receivables: totalReceivable,
      supplier_payables: totalPayable,
      worker_advances: totalWorkerAdvances,
      net_position: round2(totalReceivable - totalPayable - totalWorkerAdvances),
    },
    receivables: receivables.filter((row) => row.balance_due > 0),
    payables: payables.filter((row) => row.balance_due > 0),
    worker_advances: workerAdvances.filter((row) => row.balance_due > 0),
  });
});


router.get('/finance/debts/export/xlsx', requireAuth, requirePermission('treasury:read'), (_req, res) => {
  const db = getDb();
  const receivables = db.prepare(
    `SELECT d.doc_number AS Facture, c.name AS Client, d.issue_date AS Date_emission,
            d.due_date AS Echeance, d.total_ttc AS Total_TTC_DA, d.amount_paid AS Regle_DA,
            COALESCE((SELECT SUM(a.total_ttc) FROM commercial_documents a
                      WHERE a.doc_type='avoir' AND a.linked_doc_id=d.id
                        AND a.status NOT IN ('draft','cancelled')), 0) AS Avoirs_DA,
            MAX(0, d.total_ttc-d.amount_paid-COALESCE((SELECT SUM(a.total_ttc)
              FROM commercial_documents a WHERE a.doc_type='avoir' AND a.linked_doc_id=d.id
              AND a.status NOT IN ('draft','cancelled')),0)) AS Reste_Du_DA
     FROM commercial_documents d JOIN clients c ON c.id=d.client_id
     WHERE d.doc_type='facture' AND d.status NOT IN ('draft','cancelled')
       AND MAX(0, d.total_ttc-d.amount_paid-COALESCE((SELECT SUM(a.total_ttc)
         FROM commercial_documents a WHERE a.doc_type='avoir' AND a.linked_doc_id=d.id
         AND a.status NOT IN ('draft','cancelled')),0)) > 0
     ORDER BY COALESCE(d.due_date,d.issue_date), d.id`
  ).all();
  const payables = db.prepare(
    `SELECT pu.po_number AS Commande, pu.supplier_invoice_no AS Facture_Fournisseur,
            s.name AS Fournisseur, pu.order_date AS Date_commande, pu.total_ttc AS Total_TTC_DA,
            pu.amount_paid AS Regle_DA, MAX(0,pu.total_ttc-pu.amount_paid) AS Reste_Du_DA,
            p.project_number AS Code_Chantier, p.title AS Chantier
     FROM purchases pu JOIN suppliers s ON s.id=pu.supplier_id
     LEFT JOIN projects p ON p.id=pu.project_id
     WHERE pu.status IN ('ordered','received','partial_paid','paid')
       AND MAX(0,pu.total_ttc-pu.amount_paid)>0
     ORDER BY pu.order_date, pu.id`
  ).all();
  const advances = db.prepare(
    `SELECT w.full_name AS Salarie, w.job_title AS Poste,
            COALESCE(SUM(a.advance_amount),0) AS Avances_Versees_DA,
            COALESCE((SELECT SUM(ps.advances_deducted) FROM payslips ps
              JOIN payroll_periods pp ON pp.id=ps.payroll_period_id
              WHERE ps.worker_id=w.id AND pp.status='approved'),0) AS Recuperees_DA,
            MAX(0,COALESCE(SUM(a.advance_amount),0)-COALESCE((SELECT SUM(ps.advances_deducted)
              FROM payslips ps JOIN payroll_periods pp ON pp.id=ps.payroll_period_id
              WHERE ps.worker_id=w.id AND pp.status='approved'),0)) AS Solde_DA
     FROM workers w LEFT JOIN attendance a ON a.worker_id=w.id AND a.approval_status='approved'
     GROUP BY w.id HAVING Solde_DA>0 ORDER BY w.full_name COLLATE NOCASE`
  ).all();
  sendXlsx(res, 'dettes_creances_gestionpro_dz.xlsx', [
    { name: 'Creances_Clients', rows: receivables },
    { name: 'Dettes_Fournisseurs', rows: payables },
    { name: 'Avances_Salaries', rows: advances },
  ]);
});

// ==================== REPORTS ====================
router.get('/reports/summary', requireAuth, requirePermission('reports:read'), (_req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, project_number, title, status FROM projects').all() as any[];
  const projectProfits = projects.map((p) => {
    const f = calculateProjectFinancials(p.id);
    return {
      project_number: p.project_number,
      title: p.title,
      status: p.status,
      invoiced_ht: f.invoiced_ht,
      total_actual_cost: f.total_actual_cost,
      net_profit: f.net_profit,
      budget_variance: f.budget_variance,
    };
  });

  const workerCosts = db
    .prepare(
      `SELECT w.full_name, w.job_title,
         COALESCE(SUM(a.day_fraction), 0) AS total_days,
         COALESCE(SUM(a.advance_amount), 0) AS total_advances
       FROM workers w
       LEFT JOIN attendance a ON a.worker_id = w.id AND a.approval_status = 'approved'
       GROUP BY w.id ORDER BY total_days DESC`
    )
    .all();

  const fleetCosts = db
    .prepare(
      `SELECT v.name, v.registration,
         (SELECT COALESCE(SUM(total_cost), 0) FROM fuel_entries fe WHERE fe.vehicle_id = v.id) AS fuel_cost,
         (SELECT COALESCE(SUM(total_cost), 0) FROM repair_orders ro WHERE ro.vehicle_id = v.id) AS repair_cost
       FROM vehicles v`
    )
    .all();

  res.json({ projectProfits, workerCosts, fleetCosts });
});

router.get('/reports/export/xlsx', requireAuth, requirePermission('reports:export'), (_req, res) => {
  const db = getDb();
  const projects = db.prepare('SELECT id, project_number, title, status FROM projects').all() as any[];
  const projectRows = projects.map((p) => {
    const f = calculateProjectFinancials(p.id);
    return {
      Code: p.project_number, Chantier: p.title, Statut: p.status,
      Facturé_HT_DA: f.invoiced_ht, Matériaux_DA: f.materials_cost,
      Main_Oeuvre_DA: f.labor_cost, Carburant_DA: f.fuel_cost,
      Réparations_DA: f.repairs_cost, Frais_Généraux_DA: f.overhead_cost,
      Coût_Réel_Total_DA: f.total_actual_cost, Bénéfice_Net_DA: f.net_profit,
      Écart_Budget_DA: f.budget_variance,
    };
  });
  const stockRows = db.prepare('SELECT code AS Code, name AS Matériau, category AS Catégorie, current_quantity AS Stock, unit AS Unité, purchase_price AS Prix_Achat_DA, min_stock_level AS Seuil_alerte FROM materials').all();
  const invoiceRows = db.prepare(
    `SELECT d.doc_number AS Reference, d.doc_type AS Type, d.issue_date AS Date, d.due_date AS Echeance,
            c.name AS Client, p.project_number AS Code_chantier, p.title AS Chantier,
            d.status AS Statut, d.total_ht AS Total_HT_DA, d.total_tva AS TVA_DA,
            d.total_ttc AS Total_TTC_DA, d.amount_paid AS Regle_DA,
            MAX(0, d.total_ttc-d.amount_paid-COALESCE((SELECT SUM(a.total_ttc) FROM commercial_documents a WHERE a.doc_type='avoir' AND a.linked_doc_id=d.id AND a.status NOT IN ('draft','cancelled')),0)) AS Reste_DA
     FROM commercial_documents d JOIN clients c ON c.id=d.client_id
     LEFT JOIN projects p ON p.id=d.project_id ORDER BY d.issue_date DESC, d.id DESC`
  ).all();
  const paymentRows = db.prepare(
    `SELECT p.payment_date AS Date, p.receipt_number AS Recu, p.payment_method AS Mode,
            p.reference AS Reference_paiement, p.amount AS Montant_DA,
            c.name AS Client, s.name AS Fournisseur, d.doc_number AS Piece,
            p.is_reversal AS Contre_passation
     FROM payments p LEFT JOIN clients c ON c.id=p.client_id
     LEFT JOIN suppliers s ON s.id=p.supplier_id
     LEFT JOIN commercial_documents d ON d.id=p.document_id
     ORDER BY p.payment_date DESC, p.id DESC`
  ).all();
  const supplierRows = db.prepare(
    `SELECT s.name AS Fournisseur, s.phone AS Telephone, s.address AS Adresse,
            COUNT(pu.id) AS Nombre_commandes, COALESCE(SUM(pu.total_ttc),0) AS Total_commandes_DA,
            COALESCE(SUM(pu.amount_paid),0) AS Regle_DA,
            COALESCE(SUM(MAX(0,pu.total_ttc-pu.amount_paid)),0) AS Reste_DA
     FROM suppliers s LEFT JOIN purchases pu ON pu.supplier_id=s.id AND pu.status IN ('ordered','received','partial_paid','paid')
     GROUP BY s.id ORDER BY s.name`
  ).all();
  const workerRows = db.prepare(
    `SELECT w.full_name AS Salarie, w.job_title AS Poste, w.status AS Statut,
            COALESCE(SUM(a.day_fraction),0) AS Jours_approuves,
            COALESCE(SUM(a.advance_amount),0) AS Avances_DA
     FROM workers w LEFT JOIN attendance a ON a.worker_id=w.id AND a.approval_status='approved'
     GROUP BY w.id ORDER BY w.full_name`
  ).all();
  sendXlsx(res, 'rapport_complet_gestionpro_dz.xlsx', [
    { name: 'Rentabilité_Chantiers', rows: projectRows },
    { name: 'État_Stock', rows: stockRows },
    { name: 'Devis_Factures', rows: invoiceRows },
    { name: 'Règlements', rows: paymentRows },
    { name: 'Soldes_Fournisseurs', rows: supplierRows },
    { name: 'Activité_Salariés', rows: workerRows },
  ]);
});

// ==================== SETTINGS, USERS, IMPORT & AUDIT ====================
router.get('/settings', requireAuth, (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM company_settings WHERE id = 1').get());
});

router.put('/settings', requireAuth, requirePermission('settings:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM company_settings WHERE id = 1').get() as any;
  db.prepare(
    `UPDATE company_settings SET name=?, legal_form=?, address=?, phone=?, email=?, nif=?, nis=?, rc=?, ai=?, header_note=?, footer_note=?, logo_data=?, stamp_data=?, overhead_rate_percent=?, auto_backup_time=?, auto_backup_keep_daily=?, updated_at=datetime('now') WHERE id = 1`
  ).run(
    b.name ?? old.name,
    b.legal_form ?? old.legal_form,
    b.address ?? old.address,
    b.phone ?? old.phone,
    b.email ?? old.email,
    b.nif ?? old.nif,
    b.nis ?? old.nis,
    b.rc ?? old.rc,
    b.ai ?? old.ai,
    b.header_note ?? old.header_note,
    b.footer_note ?? old.footer_note,
    b.logo_data ?? old.logo_data,
    b.stamp_data ?? old.stamp_data,
    b.overhead_rate_percent !== undefined ? Number(b.overhead_rate_percent) : old.overhead_rate_percent,
    b.auto_backup_time ?? old.auto_backup_time,
    b.auto_backup_keep_daily !== undefined ? Number(b.auto_backup_keep_daily) : old.auto_backup_keep_daily
  );
  logAudit(req.user!, 'UPDATE', 'company_settings', 1, old.name, b.name ?? old.name);
  res.json(db.prepare('SELECT * FROM company_settings WHERE id = 1').get());
});

router.get('/users', requireAuth, requirePermission('settings:read'), (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT id, name, username, role, status, last_login, created_at FROM users ORDER BY id ASC').all());
});

router.post('/users', requireAuth, requirePermission('settings:write'), (req: AuthedRequest, res) => {
  const b = req.body || {};
  if (!b.name?.trim() || !b.username?.trim() || !b.password) {
    res.status(400).json({ error: 'Nom, identifiant et mot de passe sont obligatoires.' });
    return;
  }
  const db = getDb();
  const info = db
    .prepare("INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, ?, 'active')")
    .run(b.name.trim(), b.username.trim(), hashPassword(String(b.password)), b.role || 'supervisor');
  logAudit(req.user!, 'CREATE', 'user', b.username.trim(), '', b.role || 'supervisor');
  res.status(201).json(db.prepare('SELECT id, name, username, role, status FROM users WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/users/:id', requireAuth, requirePermission('settings:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const db = getDb();
  const old = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
  if (!old) {
    res.status(404).json({ error: 'Utilisateur introuvable.' });
    return;
  }
  db.prepare('UPDATE users SET name=?, role=?, status=? WHERE id=?').run(
    b.name ?? old.name,
    b.role ?? old.role,
    b.status ?? old.status,
    id
  );
  if (b.password) {
    db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(String(b.password)), id);
  }
  logAudit(req.user!, 'UPDATE', 'user', old.username, old.role, b.role ?? old.role);
  res.json(db.prepare('SELECT id, name, username, role, status FROM users WHERE id = ?').get(id));
});

router.get('/audit-logs', requireAuth, requirePermission('audit:read'), (_req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 200').all());
});

// Guided Excel / CSV Import
router.post('/import/preview', requireAuth, requirePermission('settings:write'), uploadMemory.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Veuillez sélectionner un fichier Excel (.xlsx) ou CSV.' });
    return;
  }
  const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, any>[];
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  res.json({ totalRows: rows.length, headers, previewRows: rows.slice(0, 10), rows });
});

router.post('/import/commit', requireAuth, requirePermission('settings:write'), (req: AuthedRequest, res) => {
  const { target, rows } = req.body || {};
  if (!Array.isArray(rows) || !['clients', 'materials', 'workers', 'suppliers'].includes(target)) {
    res.status(400).json({ error: 'Cible d’importation ou lignes invalides.' });
    return;
  }
  const db = getDb();
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    try {
      if (target === 'clients') {
        const name = String(r.Nom || r.name || r.RaisonSociale || '').trim();
        if (!name) throw new Error('Nom manquant');
        const dup = db.prepare('SELECT id FROM clients WHERE name = ?').get(name);
        if (dup) throw new Error('Client déjà existant');
        db.prepare("INSERT INTO clients (client_type, name, phone, email, address, nif, status) VALUES ('company', ?, ?, ?, ?, ?, 'active')").run(
          name,
          String(r.Téléphone || r.phone || ''),
          String(r.Email || r.email || ''),
          String(r.Adresse || r.address || ''),
          String(r.NIF || r.nif || '')
        );
        imported++;
      } else if (target === 'materials') {
        const name = String(r.Désignation || r.Nom || r.name || '').trim();
        const code = String(r.Code || r.code || `MAT-IMP-${Date.now()}-${i}`).trim();
        if (!name) throw new Error('Désignation manquante');
        const dup = db.prepare('SELECT id FROM materials WHERE code = ?').get(code);
        if (dup) throw new Error('Code matériau déjà existant');
        db.prepare(
          "INSERT INTO materials (name, code, category, unit, current_quantity, purchase_price, min_stock_level) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).run(
          name,
          code,
          String(r.Catégorie || r.category || 'Import'),
          String(r.Unité || r.unit || 'U'),
          Number(r.Quantité || r.quantity || 0),
          Number(r.Prix || r.purchase_price || 0),
          Number(r.Seuil || r.min_stock_level || 5)
        );
        imported++;
      } else if (target === 'workers') {
        const name = String(r.Nom || r.full_name || '').trim();
        if (!name) throw new Error('Nom manquant');
        const dup = db.prepare('SELECT id FROM workers WHERE full_name = ?').get(name);
        if (dup) throw new Error('Employé déjà existant');
        db.prepare(
          "INSERT INTO workers (full_name, job_title, wage_type, daily_wage, hire_date, phone, status) VALUES (?, ?, 'daily', ?, ?, ?, 'active')"
        ).run(
          name,
          String(r.Poste || r.job_title || 'Manœuvre'),
          Number(r.Salaire_Jour || r.daily_wage || 3000),
          new Date().toISOString().slice(0, 10),
          String(r.Téléphone || r.phone || '')
        );
        imported++;
      } else if (target === 'suppliers') {
        const name = String(r.Nom || r.name || '').trim();
        if (!name) throw new Error('Nom manquant');
        const dup = db.prepare('SELECT id FROM suppliers WHERE name = ?').get(name);
        if (dup) throw new Error('Fournisseur déjà existant');
        db.prepare('INSERT INTO suppliers (name, phone, address, nif) VALUES (?, ?, ?, ?)').run(
          name,
          String(r.Téléphone || r.phone || ''),
          String(r.Adresse || r.address || ''),
          String(r.NIF || r.nif || '')
        );
        imported++;
      }
    } catch (e: any) {
      errors.push(`Ligne ${i + 1} : ${e.message}`);
    }
  }
  logAudit(req.user!, 'IMPORT', target, `${imported} lignes`, '', `${errors.length} erreur(s)`);
  res.json({ imported, errors });
});

// ==================== BACKUP & RESTORE ====================
router.get('/backups', requireAuth, requirePermission('backup:manage'), (_req, res) => {
  res.json(listBackups());
});

router.get('/backups/health', requireAuth, requirePermission('backup:manage'), (_req, res) => {
  res.json(getBackupHealth());
});

router.put('/backups/settings', requireAuth, requirePermission('backup:manage'), (req: AuthedRequest, res) => {
  try {
    const settings = saveBackupSettings(req.body || {});
    logAudit(
      req.user!,
      'UPDATE',
      'backup_settings',
      settings.externalDir || 'dossier non configuré',
      '',
      `Copie externe : ${settings.externalDir || 'aucune'} · conservation ${settings.keepManual} · alerte ${settings.warnAfterDays} jour(s)`
    );
    res.json(settings);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Réglages de sauvegarde invalides.' });
  }
});

router.post('/backups/create', requireAuth, requirePermission('backup:manage'), (req: AuthedRequest, res) => {
  const type = req.body?.backup_type === 'usb_export' ? 'usb_export' : 'manual_local';
  const entry = createFullBackup(type, req.user!.name);
  logAudit(req.user!, 'BACKUP', 'database', entry.file_name, '', `${entry.size_bytes} octets`);
  res.status(201).json(entry);
});

router.get('/backups/:id/download', requireAuth, requirePermission('backup:manage'), (req, res) => {
  const db = getDb();
  const b = db.prepare('SELECT * FROM backup_history WHERE id = ?').get(Number(req.params.id)) as any;
  if (!b || !fs.existsSync(b.file_path)) {
    res.status(404).json({ error: 'Archive de sauvegarde introuvable sur le disque.' });
    return;
  }
  res.download(b.file_path, b.file_name);
});

router.post('/backups/:id/verify', requireAuth, requirePermission('backup:manage'), (req: AuthedRequest, res) => {
  const db = getDb();
  const backup = db.prepare('SELECT * FROM backup_history WHERE id = ?').get(Number(req.params.id)) as any;
  if (!backup || !fs.existsSync(backup.file_path)) {
    res.status(404).json({ error: 'Archive de sauvegarde introuvable.' });
    return;
  }
  try {
    const result = verifyBackupArchive(backup.file_path);
    db.prepare('UPDATE backup_history SET verified = 1 WHERE id = ?').run(backup.id);
    logAudit(req.user!, 'VERIFY', 'backup', backup.file_name, '', `${result.documentCount} document(s), SQLite OK`);
    res.json(result);
  } catch (error: any) {
    db.prepare('UPDATE backup_history SET verified = 0 WHERE id = ?').run(backup.id);
    logAudit(req.user!, 'VERIFY_FAILED', 'backup', backup.file_name, '', error.message || 'Échec de vérification');
    res.status(422).json({ error: error.message || 'La vérification de cette archive a échoué.' });
  }
});

router.post('/backups/restore', requireAuth, requirePermission('backup:manage'), uploadMemory.single('archive'), (req: AuthedRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'Veuillez sélectionner une archive ZIP de sauvegarde IDEAL.' });
    return;
  }
  try {
    const result = restoreFromZip(req.file.buffer, req.user!.name);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Échec lors de la restauration de l’archive.' });
  }
});

// --- INVOICES / COMMERCIAL DOCUMENTS ---
router.delete('/commercial-documents/:id', requireAuth, requirePermission('invoices:write'), requirePermission('lifecycle:delete'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const result = db.transaction(() => {
    const row = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
    if (!row) return { status: 404, error: 'Pièce introuvable.' };
    if (row.status !== 'draft') {
      return { status: 400, error: 'Suppression impossible : seuls les brouillons peuvent être supprimés. Utilisez l’annulation pour une pièce émise.' };
    }
    const payments = (db.prepare('SELECT COUNT(*) c FROM payments WHERE document_id = ?').get(id) as any).c;
    if (payments > 0) return { status: 400, error: 'Suppression impossible : des règlements sont liés.' };
    const deadline = row.deletion_eligible_until || row.created_at;
    if (!isDeletionEligible(deadline)) {
      return { status: 400, error: 'Suppression impossible : la période de 7 jours est dépassée.' };
    }

    // Remove child rows first and commit both deletes atomically.
    db.prepare('DELETE FROM commercial_lines WHERE document_id = ?').run(id);
    const deleted = db.prepare("DELETE FROM commercial_documents WHERE id = ? AND status = 'draft'").run(id);
    if (deleted.changes !== 1) throw new Error('DRAFT_DOCUMENT_DELETE_CONFLICT');
    logAudit(req.user!, 'DELETE', 'commercial_document', id, '', 'Suppression brouillon (période 7 jours)');
    return { status: 200, error: null };
  }).immediate();

  if (result.error) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json({ ok: true });
});
router.post('/commercial-documents/:id/archive', requireAuth, requirePermission('invoices:write'), requirePermission('lifecycle:archive'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Pièce introuvable.' }); return; }
  archiveEntity('commercial_documents', id, req.user!.id, (req.body?.reason || 'Archivage manuel'));
  logAudit(req.user!, 'ARCHIVE', 'commercial_document', id, row.status, 'Archivé');
  res.json({ ok: true });
});
router.post('/commercial-documents/:id/restore', requireAuth, requirePermission('invoices:write'), requirePermission('lifecycle:restore'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Pièce introuvable.' }); return; }
  restoreEntity('commercial_documents', id);
  logAudit(req.user!, 'RESTORE', 'commercial_document', id, 'archived', 'Restauré');
  res.json({ ok: true });
});

router.post('/commercial-documents/:id/cancel', requireAuth, requirePermission('invoices:write'), requirePermission('lifecycle:cancel'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const row = db.prepare('SELECT * FROM commercial_documents WHERE id = ?').get(id) as any;
  if (!row) { res.status(404).json({ error: 'Pièce introuvable.' }); return; }
  if (row.status === 'cancelled') { res.status(400).json({ error: 'Cette pièce est déjà annulée.' }); return; }
  if (row.status !== 'draft') {
    res.status(400).json({ error: 'Seuls les brouillons peuvent être annulés. Utilisez une facture d’avoir pour une pièce émise.' });
    return;
  }
  if (Number(row.amount_paid || 0) > 0) {
    res.status(400).json({ error: 'Annulation impossible : des règlements sont liés.' });
    return;
  }
  db.prepare("UPDATE commercial_documents SET status='cancelled', updated_at=?, revision = revision + 1 WHERE id=?").run(new Date().toISOString().slice(0,19).replace('T',' '), id);
  logAudit(req.user!, 'CANCEL', 'commercial_document', row.doc_number, row.status, 'cancelled');
  res.json({ ok: true, status: 'cancelled' });
});

router.post('/lifecycle/review', requireAuth, requirePermission('audit:read'), requirePermission('lifecycle:review'), (req: AuthedRequest, res) => {
  const table = String(req.body?.table || '');
  const id = Number(req.body?.id);
  const allowed = ['clients','suppliers','workers','projects','vehicles','materials','services','commercial_documents'];
  if (!allowed.includes(table) || !Number.isFinite(id)) {
    res.status(400).json({ error: 'Entité non supportée.' });
    return;
  }
  const db = getDb();
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id) as any;
  if (!row) { res.status(404).json({ error: 'Enregistrement introuvable.' }); return; }
  if (row.lifecycle_status !== 'archived') {
    res.status(400).json({ error: 'Seuls les enregistrements archivés peuvent être revus.' });
    return;
  }
  if (!isReviewDue(row.retention_review_due_at)) {
    res.status(400).json({ error: 'La revue annuelle n’est pas encore due.' });
    return;
  }
  markReviewed(table, id, req.user!.id);
  logAudit(req.user!, 'REVIEW', table, id, 'archived', 'Revue annuelle effectuée');
  res.json({ ok: true });
});

router.get('/lifecycle/overview', requireAuth, requirePermission('dashboard:view'), requirePermission('lifecycle:view'), (_req, res) => {
  res.json(listLifecycleRecords());
});

router.get('/notifications', requireAuth, requirePermission('lifecycle:view'), (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM notifications ORDER BY id DESC LIMIT 100').all();
  res.json(rows);
});

router.post('/notifications/:id/read', requireAuth, requirePermission('lifecycle:view'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);
  res.json({ ok: true });
});

router.post('/lifecycle/notifications/sync', requireAuth, requirePermission('audit:read'), requirePermission('lifecycle:review'), (_req, res) => {
  const created = syncRetentionNotifications();
  res.json({ created });
});

// ==================== BOQ / ESTIMATES / RATE ANALYSIS ====================
const BOQ_RESOURCE_TYPES = ['material', 'labour', 'equipment', 'subcontract', 'transport'];

function boqItemTotals(item: any) {
  const resources = Array.isArray(item.resources) ? item.resources : [];
  const unitCost = round2(
    resources.reduce((sum: number, r: any) => sum + Number(r.quantity || 0) * Number(r.unit_cost || 0), 0)
  );
  const quantity = Number(item.quantity || 0);
  const unitPrice = Number(item.unit_price || 0);
  return { ...item, unit_cost: unitCost, line_ht: round2(quantity * unitPrice), line_cost: round2(quantity * unitCost) };
}

function loadBoqVersion(versionId: number) {
  const db = getDb();
  const version = db
    .prepare('SELECT v.*, u.name AS created_by_name FROM boq_versions v LEFT JOIN users u ON u.id = v.created_by WHERE v.id = ?')
    .get(versionId) as any;
  if (!version) return null;
  const sections = db.prepare('SELECT * FROM boq_sections WHERE version_id = ? ORDER BY sort_order ASC, id ASC').all(versionId) as any[];
  const items = db.prepare('SELECT * FROM boq_items WHERE version_id = ? ORDER BY sort_order ASC, id ASC').all(versionId) as any[];
  const resources = db
    .prepare(
      `SELECT r.* FROM boq_item_resources r
       JOIN boq_items i ON i.id = r.item_id
       WHERE i.version_id = ? ORDER BY r.sort_order ASC, r.id ASC`
    )
    .all(versionId) as any[];
  const byItem = new Map<number, any[]>();
  for (const r of resources) {
    const list = byItem.get(r.item_id) || [];
    list.push(r);
    byItem.set(r.item_id, list);
  }
  const computed = items.map((i) => boqItemTotals({ ...i, resources: byItem.get(i.id) || [] }));
  const totalHt = round2(computed.reduce((s, i) => s + i.line_ht, 0));
  const totalCost = round2(computed.reduce((s, i) => s + i.line_cost, 0));
  return {
    ...version,
    sections,
    items: computed,
    totals: {
      item_count: computed.length,
      total_ht: totalHt,
      total_cost: totalCost,
      margin: round2(totalHt - totalCost),
      margin_percent: totalHt > 0 ? round2(((totalHt - totalCost) / totalHt) * 100) : 0,
    },
  };
}

function readDraftBoqVersion(versionId: number, res: express.Response) {
  const version = getDb().prepare('SELECT * FROM boq_versions WHERE id = ?').get(versionId) as any;
  if (!version) {
    res.status(404).json({ error: 'Version de BOQ introuvable.' });
    return null;
  }
  if (version.status !== 'draft') {
    res.status(400).json({ error: 'Cette version de BOQ est approuvée ou remplacée : dupliquez-la pour la modifier.' });
    return null;
  }
  return version;
}

function readBoqItemDraft(itemId: number, res: express.Response) {
  const item = getDb().prepare('SELECT * FROM boq_items WHERE id = ?').get(itemId) as any;
  if (!item) {
    res.status(404).json({ error: 'Poste de BOQ introuvable.' });
    return null;
  }
  const version = getDb().prepare('SELECT * FROM boq_versions WHERE id = ?').get(item.version_id) as any;
  if (!version || version.status !== 'draft') {
    res.status(400).json({ error: 'Seule une version de BOQ en brouillon peut être modifiée.' });
    return null;
  }
  return item;
}

function normalizeBoqUnit(value: unknown): string | null {
  const unit = String(value ?? 'U').trim();
  if (!unit) return 'U';
  if (unit.length > 20) return null;
  return unit;
}

function normalizeBoqQuantity(value: unknown, fallback: number): number | null {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
}

router.get('/projects/:id/boq', requireAuth, requirePermission('projects:read'), (req, res) => {
  const projectId = Number(req.params.id);
  const db = getDb();
  const project = db.prepare('SELECT id, project_number, title FROM projects WHERE id = ?').get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: 'Chantier introuvable.' });
    return;
  }
  const versions = db
    .prepare('SELECT id FROM boq_versions WHERE project_id = ? ORDER BY version_number DESC')
    .all(projectId) as Array<{ id: number }>;
  const detailed = versions.map((v) => loadBoqVersion(v.id));
  res.json({
    project,
    versions: detailed.map((v: any) => ({
      id: v.id,
      project_id: v.project_id,
      version_number: v.version_number,
      label: v.label,
      status: v.status,
      notes: v.notes,
      created_by_name: v.created_by_name,
      approved_at: v.approved_at,
      created_at: v.created_at,
      updated_at: v.updated_at,
      totals: v.totals,
      section_count: v.sections.length,
    })),
  });
});

router.post('/projects/:id/boq/versions', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const projectId = Number(req.params.id);
  const db = getDb();
  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: 'Chantier introuvable.' });
    return;
  }
  const createVersion = db.transaction(() => {
    const next = db
      .prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS n FROM boq_versions WHERE project_id = ?')
      .get(projectId) as { n: number };
    const info = db
      .prepare(
        `INSERT INTO boq_versions (project_id, version_number, label, status, notes, created_by)
         VALUES (?, ?, ?, 'draft', ?, ?)`
      )
      .run(projectId, next.n, String(req.body?.label || `Version ${next.n}`).trim(), String(req.body?.notes || ''), req.user!.id);
    return Number(info.lastInsertRowid);
  });
  const versionId = createVersion.immediate();
  logAudit(req.user!, 'CREATE', 'boq_version', versionId, '', `Chantier ${projectId}`);
  res.status(201).json(loadBoqVersion(versionId));
});

router.get('/boq/versions/:id', requireAuth, requirePermission('projects:read'), (req, res) => {
  const version = loadBoqVersion(Number(req.params.id));
  if (!version) {
    res.status(404).json({ error: 'Version de BOQ introuvable.' });
    return;
  }
  res.json(version);
});

router.put('/boq/versions/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const version = readDraftBoqVersion(Number(req.params.id), res) as any;
  if (!version) return;
  const label = String(req.body?.label ?? version.label).trim();
  if (!label) {
    res.status(400).json({ error: 'Le libellé de la version est obligatoire.' });
    return;
  }
  getDb()
    .prepare("UPDATE boq_versions SET label = ?, notes = ?, updated_at = datetime('now') WHERE id = ?")
    .run(label, String(req.body?.notes ?? version.notes), version.id);
  logAudit(req.user!, 'UPDATE', 'boq_version', version.id, version.label, label);
  res.json(loadBoqVersion(version.id));
});

router.post('/boq/versions/:id/approve', requireAuth, requirePermission('projects:approve'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const version = db.prepare('SELECT * FROM boq_versions WHERE id = ?').get(id) as any;
  if (!version) {
    res.status(404).json({ error: 'Version de BOQ introuvable.' });
    return;
  }
  if (version.status === 'approved') {
    res.status(400).json({ error: 'Cette version de BOQ est déjà approuvée.' });
    return;
  }
  const itemCount = (db.prepare('SELECT COUNT(*) AS c FROM boq_items WHERE version_id = ?').get(id) as any).c;
  if (itemCount === 0) {
    res.status(400).json({ error: 'Impossible d’approuver une version de BOQ sans aucun poste.' });
    return;
  }
  db.transaction(() => {
    db.prepare("UPDATE boq_versions SET status='superseded', updated_at=datetime('now') WHERE project_id = ? AND status='approved' AND id <> ?").run(
      version.project_id,
      id
    );
    db.prepare("UPDATE boq_versions SET status='approved', approved_by=?, approved_at=datetime('now'), updated_at=datetime('now') WHERE id=?").run(
      req.user!.id,
      id
    );
  })();
  logAudit(req.user!, 'APPROVE', 'boq_version', id, version.status, 'approved');
  res.json(loadBoqVersion(id));
});

router.post('/boq/versions/:id/duplicate', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const source = db.prepare('SELECT * FROM boq_versions WHERE id = ?').get(id) as any;
  if (!source) {
    res.status(404).json({ error: 'Version de BOQ introuvable.' });
    return;
  }
  const newId = db.transaction(() => {
    const next = db
      .prepare('SELECT COALESCE(MAX(version_number), 0) + 1 AS n FROM boq_versions WHERE project_id = ?')
      .get(source.project_id) as { n: number };
    const info = db
      .prepare(
        `INSERT INTO boq_versions (project_id, version_number, label, status, notes, created_by)
         VALUES (?, ?, ?, 'draft', ?, ?)`
      )
      .run(
        source.project_id,
        next.n,
        String(req.body?.label || `Version ${next.n}`).trim(),
        String(req.body?.notes || `Révision de la version ${source.version_number}`),
        req.user!.id
      );
    const copyId = Number(info.lastInsertRowid);
    const sectionMap = new Map<number, number>();
    for (const s of db.prepare('SELECT * FROM boq_sections WHERE version_id = ? ORDER BY sort_order, id').all(id) as any[]) {
      const si = db
        .prepare('INSERT INTO boq_sections (version_id, code, title, sort_order) VALUES (?, ?, ?, ?)')
        .run(copyId, s.code, s.title, s.sort_order);
      sectionMap.set(s.id, Number(si.lastInsertRowid));
    }
    for (const item of db.prepare('SELECT * FROM boq_items WHERE version_id = ? ORDER BY sort_order, id').all(id) as any[]) {
      const ii = db
        .prepare(
          `INSERT INTO boq_items (version_id, section_id, code, description, unit, quantity, unit_price, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          copyId,
          item.section_id ? sectionMap.get(item.section_id) ?? null : null,
          item.code,
          item.description,
          item.unit,
          item.quantity,
          item.unit_price,
          item.sort_order
        );
      const newItemId = Number(ii.lastInsertRowid);
      for (const r of db.prepare('SELECT * FROM boq_item_resources WHERE item_id = ? ORDER BY sort_order, id').all(item.id) as any[]) {
        db.prepare(
          `INSERT INTO boq_item_resources (item_id, resource_type, label, unit, quantity, unit_cost, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(newItemId, r.resource_type, r.label, r.unit, r.quantity, r.unit_cost, r.sort_order);
      }
    }
    return copyId;
  })();
  logAudit(req.user!, 'DUPLICATE', 'boq_version', newId, source.version_number, 'Nouvelle révision brouillon');
  res.status(201).json(loadBoqVersion(newId));
});

router.post('/boq/versions/:id/sections', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const version = readDraftBoqVersion(Number(req.params.id), res) as any;
  if (!version) return;
  const title = String(req.body?.title || '').trim();
  if (!title) {
    res.status(400).json({ error: 'Le titre de la section est obligatoire.' });
    return;
  }
  const info = getDb()
    .prepare('INSERT INTO boq_sections (version_id, code, title, sort_order) VALUES (?, ?, ?, ?)')
    .run(version.id, String(req.body?.code || '').trim(), title, Number(req.body?.sort_order || 1));
  logAudit(req.user!, 'CREATE', 'boq_section', info.lastInsertRowid, '', title);
  res.status(201).json(loadBoqVersion(version.id));
});

router.put('/boq/sections/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const db = getDb();
  const section = db.prepare('SELECT * FROM boq_sections WHERE id = ?').get(Number(req.params.id)) as any;
  if (!section) {
    res.status(404).json({ error: 'Section de BOQ introuvable.' });
    return;
  }
  const version = readDraftBoqVersion(section.version_id, res) as any;
  if (!version) return;
  const title = String(req.body?.title ?? section.title).trim();
  if (!title) {
    res.status(400).json({ error: 'Le titre de la section est obligatoire.' });
    return;
  }
  db.prepare('UPDATE boq_sections SET code = ?, title = ?, sort_order = ? WHERE id = ?').run(
    String(req.body?.code ?? section.code),
    title,
    Number(req.body?.sort_order ?? section.sort_order),
    section.id
  );
  logAudit(req.user!, 'UPDATE', 'boq_section', section.id, section.title, title);
  res.json(loadBoqVersion(version.id));
});

router.delete('/boq/sections/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const db = getDb();
  const section = db.prepare('SELECT * FROM boq_sections WHERE id = ?').get(Number(req.params.id)) as any;
  if (!section) {
    res.status(404).json({ error: 'Section de BOQ introuvable.' });
    return;
  }
  const version = readDraftBoqVersion(section.version_id, res) as any;
  if (!version) return;
  db.prepare('DELETE FROM boq_sections WHERE id = ?').run(section.id);
  logAudit(req.user!, 'DELETE', 'boq_section', section.id, section.title, 'Section supprimée (brouillon)');
  res.json(loadBoqVersion(version.id));
});

router.post('/boq/versions/:id/items', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const version = readDraftBoqVersion(Number(req.params.id), res) as any;
  if (!version) return;
  const b = req.body || {};
  const description = String(b.description || '').trim();
  const unit = normalizeBoqUnit(b.unit);
  const quantity = normalizeBoqQuantity(b.quantity, 0);
  const unitPrice = normalizeBoqQuantity(b.unit_price, 0);
  if (!description) {
    res.status(400).json({ error: 'La désignation du poste est obligatoire.' });
    return;
  }
  if (unit === null) {
    res.status(400).json({ error: 'L’unité de mesure est invalide (20 caractères maximum).' });
    return;
  }
  if (quantity === null || unitPrice === null) {
    res.status(400).json({ error: 'La quantité et le prix unitaire doivent être des nombres positifs ou nuls.' });
    return;
  }
  const sectionId = b.section_id ? Number(b.section_id) : null;
  if (sectionId !== null) {
    const section = getDb().prepare('SELECT id FROM boq_sections WHERE id = ? AND version_id = ?').get(sectionId, version.id);
    if (!section) {
      res.status(400).json({ error: 'La section sélectionnée n’appartient pas à cette version de BOQ.' });
      return;
    }
  }
  const info = getDb()
    .prepare(
      `INSERT INTO boq_items (version_id, section_id, code, description, unit, quantity, unit_price, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(version.id, sectionId, String(b.code || '').trim(), description, unit, quantity, unitPrice, Number(b.sort_order || 1));
  logAudit(req.user!, 'CREATE', 'boq_item', info.lastInsertRowid, '', description);
  res.status(201).json(loadBoqVersion(version.id));
});

router.put('/boq/items/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const item = readBoqItemDraft(Number(req.params.id), res) as any;
  if (!item) return;
  const b = req.body || {};
  const description = String(b.description ?? item.description).trim();
  const unit = normalizeBoqUnit(b.unit ?? item.unit);
  const quantity = normalizeBoqQuantity(b.quantity, Number(item.quantity));
  const unitPrice = normalizeBoqQuantity(b.unit_price, Number(item.unit_price));
  if (!description) {
    res.status(400).json({ error: 'La désignation du poste est obligatoire.' });
    return;
  }
  if (unit === null || quantity === null || unitPrice === null) {
    res.status(400).json({ error: 'Unité, quantité et prix unitaire doivent être valides et positifs ou nuls.' });
    return;
  }
  let sectionId = item.section_id;
  if (b.section_id !== undefined) {
    sectionId = b.section_id ? Number(b.section_id) : null;
    if (sectionId !== null) {
      const section = getDb().prepare('SELECT id FROM boq_sections WHERE id = ? AND version_id = ?').get(sectionId, item.version_id);
      if (!section) {
        res.status(400).json({ error: 'La section sélectionnée n’appartient pas à cette version de BOQ.' });
        return;
      }
    }
  }
  getDb()
    .prepare('UPDATE boq_items SET section_id = ?, code = ?, description = ?, unit = ?, quantity = ?, unit_price = ?, sort_order = ? WHERE id = ?')
    .run(sectionId, String(b.code ?? item.code).trim(), description, unit, quantity, unitPrice, Number(b.sort_order ?? item.sort_order), item.id);
  logAudit(req.user!, 'UPDATE', 'boq_item', item.id, item.description, description);
  res.json(loadBoqVersion(item.version_id));
});

router.delete('/boq/items/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const item = readBoqItemDraft(Number(req.params.id), res) as any;
  if (!item) return;
  getDb().prepare('DELETE FROM boq_items WHERE id = ?').run(item.id);
  logAudit(req.user!, 'DELETE', 'boq_item', item.id, item.description, 'Poste supprimé (brouillon)');
  res.json(loadBoqVersion(item.version_id));
});

router.post('/boq/items/:id/resources', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const item = readBoqItemDraft(Number(req.params.id), res) as any;
  if (!item) return;
  const b = req.body || {};
  const resourceType = String(b.resource_type || 'material');
  const label = String(b.label || '').trim();
  const quantity = normalizeBoqQuantity(b.quantity, 0);
  const unitCost = normalizeBoqQuantity(b.unit_cost, 0);
  if (!BOQ_RESOURCE_TYPES.includes(resourceType)) {
    res.status(400).json({ error: 'Type de ressource invalide.' });
    return;
  }
  if (!label) {
    res.status(400).json({ error: 'Le libellé de la ressource est obligatoire.' });
    return;
  }
  if (quantity === null || unitCost === null) {
    res.status(400).json({ error: 'Quantité et coût unitaire doivent être positifs ou nuls.' });
    return;
  }
  getDb()
    .prepare(
      `INSERT INTO boq_item_resources (item_id, resource_type, label, unit, quantity, unit_cost, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(item.id, resourceType, label, String(b.unit || '').trim(), quantity, unitCost, Number(b.sort_order || 1));
  logAudit(req.user!, 'CREATE', 'boq_resource', item.id, '', `${resourceType}: ${label}`);
  res.status(201).json(loadBoqVersion(item.version_id));
});

router.put('/boq/resources/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const db = getDb();
  const resource = db.prepare('SELECT * FROM boq_item_resources WHERE id = ?').get(Number(req.params.id)) as any;
  if (!resource) {
    res.status(404).json({ error: 'Ressource de BOQ introuvable.' });
    return;
  }
  const item = readBoqItemDraft(resource.item_id, res) as any;
  if (!item) return;
  const b = req.body || {};
  const resourceType = String(b.resource_type ?? resource.resource_type);
  const label = String(b.label ?? resource.label).trim();
  const quantity = normalizeBoqQuantity(b.quantity, Number(resource.quantity));
  const unitCost = normalizeBoqQuantity(b.unit_cost, Number(resource.unit_cost));
  if (!BOQ_RESOURCE_TYPES.includes(resourceType) || !label || quantity === null || unitCost === null) {
    res.status(400).json({ error: 'Ressource invalide : type, libellé, quantité et coût unitaire sont requis.' });
    return;
  }
  db.prepare('UPDATE boq_item_resources SET resource_type = ?, label = ?, unit = ?, quantity = ?, unit_cost = ?, sort_order = ? WHERE id = ?').run(
    resourceType,
    label,
    String(b.unit ?? resource.unit),
    quantity,
    unitCost,
    Number(b.sort_order ?? resource.sort_order),
    resource.id
  );
  logAudit(req.user!, 'UPDATE', 'boq_resource', resource.id, resource.label, label);
  res.json(loadBoqVersion(item.version_id));
});

router.delete('/boq/resources/:id', requireAuth, requirePermission('projects:write'), (req: AuthedRequest, res) => {
  const db = getDb();
  const resource = db.prepare('SELECT * FROM boq_item_resources WHERE id = ?').get(Number(req.params.id)) as any;
  if (!resource) {
    res.status(404).json({ error: 'Ressource de BOQ introuvable.' });
    return;
  }
  const item = readBoqItemDraft(resource.item_id, res) as any;
  if (!item) return;
  db.prepare('DELETE FROM boq_item_resources WHERE id = ?').run(resource.id);
  logAudit(req.user!, 'DELETE', 'boq_resource', resource.id, resource.label, 'Ressource supprimée (brouillon)');
  res.json(loadBoqVersion(item.version_id));
});

// ==================== BOQ → DEVIS ====================
// Turns an approved bill of quantities into a real quotation document, keeping the
// approved quantities and prices, so the estimate can be printed and sent with the
// existing quotation layout.
router.post('/boq/versions/:id/convert-to-quotation', requireAuth, requirePermission('invoices:write'), (req: AuthedRequest, res) => {
  const versionId = Number(req.params.id);
  const db = getDb();
  const version = loadBoqVersion(versionId);
  if (!version) {
    res.status(404).json({ error: 'Version de BOQ introuvable.' });
    return;
  }
  if (version.status !== 'approved') {
    res.status(400).json({ error: 'Seule une version de BOQ approuvée peut être convertie en devis.' });
    return;
  }
  if (version.items.length === 0) {
    res.status(400).json({ error: 'Cette version de BOQ ne contient aucun poste à deviser.' });
    return;
  }

  const project = db.prepare('SELECT id, client_id, title FROM projects WHERE id = ?').get(version.project_id) as any;
  if (!project) {
    res.status(404).json({ error: 'Chantier introuvable.' });
    return;
  }
  if (!project.client_id) {
    res.status(400).json({ error: 'Ce chantier n’a pas de client : le devis ne peut pas être établi.' });
    return;
  }

  const existing = db
    .prepare("SELECT id, doc_number FROM commercial_documents WHERE boq_version_id = ? AND doc_type = 'devis' AND status <> 'cancelled' LIMIT 1")
    .get(versionId) as any;
  if (existing) {
    res.status(409).json({ error: `Cette version a déjà été convertie en devis ${existing.doc_number}.`, doc_id: existing.id });
    return;
  }

  const settings = db.prepare('SELECT prefix_quote FROM company_settings WHERE id = 1').get() as { prefix_quote: string };
  const quoteLines = version.items.map((item: any) => ({
    description: item.code ? `${item.code} — ${item.description}` : item.description,
    unit: item.unit,
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
  }));
  const calc = computeDocLines(quoteLines, 0);
  const issueDate = new Date().toISOString().slice(0, 10);

  let docNumber = '';
  const docId = db
    .transaction(() => {
      docNumber = generateNextNumber(settings?.prefix_quote || 'DEV', 'commercial_documents', 'doc_number', "AND doc_type = 'devis'");
      const info = db
        .prepare(
          `INSERT INTO commercial_documents (doc_type, doc_number, client_id, project_id, issue_date, status, discount_percent, total_ht, total_tva, total_ttc, amount_paid, notes, created_by, lifecycle_status, deletion_eligible_until, boq_version_id)
           VALUES ('devis', ?, ?, ?, ?, 'draft', 0, ?, ?, ?, 0, ?, ?, 'new', datetime('now', '+7 days'), ?)`
        )
        .run(
          docNumber,
          project.client_id,
          project.id,
          issueDate,
          calc.total_ht,
          calc.total_tva,
          calc.total_ttc,
          `Établi depuis le BOQ V${version.version_number} — ${version.label}`,
          req.user!.id,
          versionId
        );
      const id = info.lastInsertRowid as number;
      const insertLine = db.prepare(
        `INSERT INTO commercial_lines (document_id, description, unit, quantity, unit_price, tva_rate, line_ht, line_tva, line_ttc, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const line of calc.lines) {
        insertLine.run(id, line.description, line.unit, line.quantity, line.unit_price, line.tva_rate, line.line_ht, line.line_tva, line.line_ttc, line.sort_order);
      }
      return id;
    })
    .immediate();

  logAudit(req.user!, 'CONVERT', 'devis', docNumber, `BOQ V${version.version_number}`, `Devis créé depuis le BOQ V${version.version_number}`);
  res.status(201).json(loadCommercialDocument(docId));
});

// ==================== DAILY SITE REPORTS (JOURNAL DE CHANTIER) ====================
const SITE_REPORT_WEATHER = ['', 'ensoleille', 'nuageux', 'pluvieux', 'venteux', 'tres_chaud', 'froid'];
const SITE_REPORT_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];

function isIsoCalendarDate(value: unknown): boolean {
  const text = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text;
}

function loadSiteReport(id: number) {
  const db = getDb();
  const report = db
    .prepare(
      `SELECT r.*, p.project_number, p.title AS project_title, p.address AS project_address,
              c.name AS client_name, ph.name AS phase_name, t.title AS task_title,
              cu.name AS created_by_name, su.name AS submitted_by_name, ru.name AS reviewed_by_name
       FROM site_reports r
       JOIN projects p ON p.id = r.project_id
       JOIN clients c ON c.id = p.client_id
       LEFT JOIN project_phases ph ON ph.id = r.phase_id
       LEFT JOIN project_tasks t ON t.id = r.task_id
       LEFT JOIN users cu ON cu.id = r.created_by
       LEFT JOIN users su ON su.id = r.submitted_by
       LEFT JOIN users ru ON ru.id = r.reviewed_by
       WHERE r.id = ?`
    )
    .get(id) as any;
  if (!report) return null;
  report.workforce = db
    .prepare(
      `SELECT w.*, k.full_name AS worker_name, k.job_title
       FROM site_report_workforce w JOIN workers k ON k.id = w.worker_id
       WHERE w.report_id = ? ORDER BY k.full_name COLLATE NOCASE ASC`
    )
    .all(id);
  report.equipment = db
    .prepare(
      `SELECT e.*, v.name AS vehicle_name, v.registration
       FROM site_report_equipment e JOIN vehicles v ON v.id = e.vehicle_id
       WHERE e.report_id = ? ORDER BY v.name COLLATE NOCASE ASC`
    )
    .all(id);
  report.materials = db
    .prepare(
      `SELECT m.*, mt.name AS material_name, mt.code AS material_code, mt.unit AS material_unit
       FROM site_report_materials m JOIN materials mt ON mt.id = m.material_id
       WHERE m.report_id = ? ORDER BY mt.name COLLATE NOCASE ASC, m.id ASC`
    )
    .all(id);
  report.attachments = db
    .prepare(
      `SELECT id, title, category, file_name, mime_type, file_size, doc_date, created_at
       FROM documents WHERE archived = 0 AND related_type = 'site_report' AND related_id = ?
       ORDER BY id DESC`
    )
    .all(id);
  report.total_hours = round2((report.workforce || []).reduce((sum: number, row: any) => sum + Number(row.hours_worked || 0), 0));
  report.total_equipment_hours = round2((report.equipment || []).reduce((sum: number, row: any) => sum + Number(row.hours_used || 0), 0));
  return report;
}

function insertSiteReportChildren(db: any, reportId: number, payload: any) {
  const insertWorker = db.prepare(
    'INSERT INTO site_report_workforce (report_id, worker_id, hours_worked, notes) VALUES (?, ?, ?, ?)'
  );
  for (const row of payload.workforce) {
    insertWorker.run(reportId, row.worker_id, row.hours_worked, row.notes);
  }
  const insertEquipment = db.prepare(
    'INSERT INTO site_report_equipment (report_id, vehicle_id, hours_used, notes) VALUES (?, ?, ?, ?)'
  );
  for (const row of payload.equipment) {
    insertEquipment.run(reportId, row.vehicle_id, row.hours_used, row.notes);
  }
  const insertMaterial = db.prepare(
    'INSERT INTO site_report_materials (report_id, material_id, quantity, unit, notes) VALUES (?, ?, ?, ?, ?)'
  );
  for (const row of payload.materials) {
    insertMaterial.run(reportId, row.material_id, row.quantity, row.unit, row.notes);
  }
}

function readSiteReportPayload(body: any) {
  const db = getDb();
  const projectId = Number(body?.project_id);
  if (!Number.isSafeInteger(projectId) || projectId <= 0) throw new Error('Le chantier est obligatoire.');
  if (!db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId)) throw new Error('Chantier introuvable.');
  if (!isIsoCalendarDate(body?.report_date)) throw new Error('La date du rapport est invalide (format AAAA-MM-JJ).');

  const optionalId = (value: unknown, label: string) => {
    if (value === '' || value === null || value === undefined) return null;
    const id = Number(value);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`${label} est invalide.`);
    return id;
  };
  const phaseId = optionalId(body?.phase_id, 'La phase');
  if (phaseId !== null && !db.prepare('SELECT id FROM project_phases WHERE id = ? AND project_id = ?').get(phaseId, projectId)) {
    throw new Error('La phase sélectionnée n’appartient pas à ce chantier.');
  }
  const taskId = optionalId(body?.task_id, 'La tâche');
  if (taskId !== null && !db.prepare('SELECT id FROM project_tasks WHERE id = ? AND project_id = ?').get(taskId, projectId)) {
    throw new Error('La tâche sélectionnée n’appartient pas à ce chantier.');
  }

  const weather = String(body?.weather ?? '');
  if (!SITE_REPORT_WEATHER.includes(weather)) throw new Error('Les conditions météorologiques sont invalides.');
  let temperature: number | null = null;
  if (body?.temperature_c !== '' && body?.temperature_c !== null && body?.temperature_c !== undefined) {
    const value = Number(body.temperature_c);
    if (!Number.isFinite(value) || value < -30 || value > 60) throw new Error('La température doit être comprise entre -30 et 60 °C.');
    temperature = round2(value);
  }

  const text = (value: unknown, max: number, label: string) => {
    const result = String(value ?? '').trim();
    if (result.length > max) throw new Error(`${label} ne doit pas dépasser ${max} caractères.`);
    return result;
  };
  const workDone = text(body?.work_done, 5000, 'Le travail réalisé');
  if (!workDone) throw new Error('Décrivez le travail réalisé sur le chantier.');
  const siteCondition = text(body?.site_condition, 1000, 'L’état du chantier');
  const observations = text(body?.observations, 2000, 'Les observations');
  const incidents = text(body?.incidents, 2000, 'Les incidents');

  const rows = (value: unknown, label: string, max: number) => {
    if (value === undefined || value === null) return [] as any[];
    if (!Array.isArray(value)) throw new Error(`${label} : format invalide.`);
    if (value.length > max) throw new Error(`${label} : ${max} lignes maximum.`);
    return value as any[];
  };
  const seenWorkers = new Set<number>();
  const workforce = rows(body?.workforce, 'La main-d’œuvre', 200).map((row) => {
    const workerId = Number(row?.worker_id);
    if (!Number.isSafeInteger(workerId) || workerId <= 0) throw new Error('Chaque ligne de main-d’œuvre doit désigner un salarié.');
    if (!db.prepare('SELECT id FROM workers WHERE id = ?').get(workerId)) throw new Error('Un salarié sélectionné est introuvable.');
    if (seenWorkers.has(workerId)) throw new Error('Un salarié ne peut apparaître qu’une seule fois par rapport.');
    seenWorkers.add(workerId);
    const hours = row?.hours_worked === '' || row?.hours_worked === undefined || row?.hours_worked === null ? 8 : Number(row.hours_worked);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error('Les heures travaillées doivent être comprises entre 0 et 24 par salarié.');
    return { worker_id: workerId, hours_worked: round2(hours), notes: text(row?.notes, 300, 'Une note de main-d’œuvre') };
  });

  const seenVehicles = new Set<number>();
  const equipment = rows(body?.equipment, 'Les engins', 100).map((row) => {
    const vehicleId = Number(row?.vehicle_id);
    if (!Number.isSafeInteger(vehicleId) || vehicleId <= 0) throw new Error('Chaque ligne d’engin doit désigner un véhicule ou un engin.');
    if (!db.prepare('SELECT id FROM vehicles WHERE id = ?').get(vehicleId)) throw new Error('Un engin sélectionné est introuvable.');
    if (seenVehicles.has(vehicleId)) throw new Error('Un engin ne peut apparaître qu’une seule fois par rapport.');
    seenVehicles.add(vehicleId);
    const hours = row?.hours_used === '' || row?.hours_used === undefined || row?.hours_used === null ? 0 : Number(row.hours_used);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) throw new Error('Les heures d’utilisation doivent être comprises entre 0 et 24 par engin.');
    return { vehicle_id: vehicleId, hours_used: round2(hours), notes: text(row?.notes, 300, 'Une note d’engin') };
  });

  const materials = rows(body?.materials, 'Les matériaux', 200).map((row) => {
    const materialId = Number(row?.material_id);
    if (!Number.isSafeInteger(materialId) || materialId <= 0) throw new Error('Chaque ligne de matériau doit désigner un matériau.');
    const material = db.prepare('SELECT id, unit FROM materials WHERE id = ?').get(materialId) as { id: number; unit: string } | undefined;
    if (!material) throw new Error('Un matériau sélectionné est introuvable.');
    const quantity = Number(row?.quantity ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000) throw new Error('La quantité consommée doit être strictement positive.');
    return {
      material_id: materialId,
      quantity: round2(quantity),
      unit: text(row?.unit, 20, 'L’unité') || material.unit || '',
      notes: text(row?.notes, 300, 'Une note de matériau'),
    };
  });

  return {
    project_id: projectId,
    phase_id: phaseId,
    task_id: taskId,
    report_date: String(body.report_date),
    weather,
    temperature_c: temperature,
    site_condition: siteCondition,
    work_done: workDone,
    observations,
    incidents,
    workforce,
    equipment,
    materials,
  };
}

router.get('/site-reports', requireAuth, requirePermission('sites:read'), (req, res) => {
  const db = getDb();
  const where: string[] = [];
  const params: Array<string | number> = [];
  const projectId = Number(req.query.project_id);
  if (Number.isSafeInteger(projectId) && projectId > 0) {
    where.push('r.project_id = ?');
    params.push(projectId);
  }
  const status = String(req.query.status || '');
  if (SITE_REPORT_STATUSES.includes(status)) {
    where.push('r.status = ?');
    params.push(status);
  }
  const from = String(req.query.from || '');
  if (from) {
    if (!isIsoCalendarDate(from)) {
      res.status(400).json({ error: 'La date de début du filtre est invalide (format AAAA-MM-JJ).' });
      return;
    }
    where.push('r.report_date >= ?');
    params.push(from);
  }
  const to = String(req.query.to || '');
  if (to) {
    if (!isIsoCalendarDate(to)) {
      res.status(400).json({ error: 'La date de fin du filtre est invalide (format AAAA-MM-JJ).' });
      return;
    }
    where.push('r.report_date <= ?');
    params.push(to);
  }
  const search = String(req.query.q || '').trim();
  if (search) {
    where.push('(r.report_number LIKE ? OR r.work_done LIKE ? OR p.title LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `SELECT r.*, p.project_number, p.title AS project_title, c.name AS client_name,
              (SELECT COUNT(*) FROM site_report_workforce w WHERE w.report_id = r.id) AS workforce_count,
              (SELECT COALESCE(SUM(w.hours_worked), 0) FROM site_report_workforce w WHERE w.report_id = r.id) AS workforce_hours,
              (SELECT COUNT(*) FROM site_report_equipment e WHERE e.report_id = r.id) AS equipment_count,
              (SELECT COUNT(*) FROM site_report_materials m WHERE m.report_id = r.id) AS material_count
       FROM site_reports r
       JOIN projects p ON p.id = r.project_id
       JOIN clients c ON c.id = p.client_id
       ${clause}
       ORDER BY r.report_date DESC, r.id DESC
       LIMIT 500`
    )
    .all(...params);
  res.json(rows);
});

router.get('/site-reports/options', requireAuth, requirePermission('sites:read'), (req, res) => {
  const db = getDb();
  const projects = db
    .prepare(
      `SELECT p.id, p.project_number, p.title, p.status
       FROM projects p WHERE p.lifecycle_status <> 'archived'
       ORDER BY p.id DESC`
    )
    .all();
  const workers = db
    .prepare("SELECT id, full_name, job_title FROM workers WHERE status = 'active' ORDER BY full_name COLLATE NOCASE ASC")
    .all();
  const materials = db
    .prepare("SELECT id, name, code, unit, current_quantity FROM materials WHERE status = 'active' ORDER BY name COLLATE NOCASE ASC")
    .all();
  const vehicles = db
    .prepare('SELECT id, name, registration FROM vehicles ORDER BY name COLLATE NOCASE ASC')
    .all();
  const projectId = Number(req.query.project_id);
  let phases: any[] = [];
  let tasks: any[] = [];
  if (Number.isSafeInteger(projectId) && projectId > 0) {
    phases = db.prepare('SELECT id, name FROM project_phases WHERE project_id = ? ORDER BY sort_order ASC, id ASC').all(projectId);
    tasks = db.prepare('SELECT id, title, phase_id FROM project_tasks WHERE project_id = ? ORDER BY id ASC').all(projectId);
  }
  res.json({ projects, workers, materials, vehicles, phases, tasks });
});

router.get('/site-reports/export/xlsx', requireAuth, requirePermission('sites:read'), (_req, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT r.report_number AS Numero, r.report_date AS Date, p.project_number AS Chantier,
              p.title AS Intitule_chantier, c.name AS Client, r.weather AS Meteo,
              r.temperature_c AS Temperature_C, r.work_done AS Travaux_realises,
              r.observations AS Observations, r.incidents AS Incidents,
              (SELECT COALESCE(SUM(w.hours_worked), 0) FROM site_report_workforce w WHERE w.report_id = r.id) AS Heures_main_oeuvre,
              (SELECT COUNT(*) FROM site_report_equipment e WHERE e.report_id = r.id) AS Nb_engins,
              (SELECT COUNT(*) FROM site_report_materials m WHERE m.report_id = r.id) AS Nb_materiaux,
              r.status AS Statut
       FROM site_reports r JOIN projects p ON p.id = r.project_id JOIN clients c ON c.id = p.client_id
       ORDER BY r.report_date DESC, r.id DESC`
    )
    .all();
  sendXlsx(res, 'journal_de_chantier.xlsx', [{ name: 'Rapports chantier', rows }]);
});

router.get('/site-reports/:id', requireAuth, requirePermission('sites:read'), (req, res) => {
  const report = loadSiteReport(Number(req.params.id));
  if (!report) {
    res.status(404).json({ error: 'Rapport de chantier introuvable.' });
    return;
  }
  res.json(report);
});

router.post('/site-reports', requireAuth, requirePermission('sites:write'), (req: AuthedRequest, res) => {
  let payload: ReturnType<typeof readSiteReportPayload>;
  try {
    payload = readSiteReportPayload(req.body || {});
  } catch (error: any) {
    res.status(400).json({ error: error.message });
    return;
  }
  const db = getDb();
  const duplicate = db
    .prepare('SELECT id, report_number FROM site_reports WHERE project_id = ? AND report_date = ?')
    .get(payload.project_id, payload.report_date) as { id: number; report_number: string } | undefined;
  if (duplicate) {
    res.status(409).json({
      error: `Un rapport de chantier existe déjà pour ce chantier à cette date (${duplicate.report_number}). Modifiez le rapport existant plutôt que d’en créer un second.`,
    });
    return;
  }
  try {
    const id = db
      .transaction(() => {
        const reportNumber = generateNextNumber('JC', 'site_reports', 'report_number');
        const info = db
          .prepare(
            `INSERT INTO site_reports (project_id, phase_id, task_id, report_number, report_date, weather, temperature_c,
                                       site_condition, work_done, observations, incidents, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)`
          )
          .run(
            payload.project_id,
            payload.phase_id,
            payload.task_id,
            reportNumber,
            payload.report_date,
            payload.weather,
            payload.temperature_c,
            payload.site_condition,
            payload.work_done,
            payload.observations,
            payload.incidents,
            req.user!.id
          );
        insertSiteReportChildren(db, Number(info.lastInsertRowid), payload);
        return Number(info.lastInsertRowid);
      })
      .immediate();
    const created = loadSiteReport(id);
    logAudit(req.user!, 'CREATE', 'site_report', id, '', `Rapport ${created?.report_number} du ${payload.report_date}`);
    res.status(201).json(created);
  } catch (error: any) {
    if (String(error?.message || '').includes('UNIQUE')) {
      res.status(409).json({ error: 'Un rapport de chantier existe déjà pour ce chantier à cette date.' });
      return;
    }
    throw error;
  }
});

router.put('/site-reports/:id', requireAuth, requirePermission('sites:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM site_reports WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Rapport de chantier introuvable.' });
    return;
  }
  if (!['draft', 'rejected'].includes(existing.status)) {
    res.status(400).json({ error: 'Seul un rapport en brouillon ou refusé peut être modifié.' });
    return;
  }
  if (req.body?.revision !== undefined && Number(req.body.revision) !== Number(existing.revision)) {
    res.status(409).json({ error: 'Ce rapport a été modifié entre-temps par un autre utilisateur. Rechargez la fiche avant de l’enregistrer.' });
    return;
  }
  let payload: ReturnType<typeof readSiteReportPayload>;
  try {
    payload = readSiteReportPayload(req.body || {});
  } catch (error: any) {
    res.status(400).json({ error: error.message });
    return;
  }
  const duplicate = db
    .prepare('SELECT id FROM site_reports WHERE project_id = ? AND report_date = ? AND id <> ?')
    .get(payload.project_id, payload.report_date, id) as { id: number } | undefined;
  if (duplicate) {
    res.status(409).json({ error: 'Un autre rapport de chantier existe déjà pour ce chantier à cette date.' });
    return;
  }
  db.transaction(() => {
    db.prepare(
      `UPDATE site_reports
       SET project_id = ?, phase_id = ?, task_id = ?, report_date = ?, weather = ?, temperature_c = ?,
           site_condition = ?, work_done = ?, observations = ?, incidents = ?, status = 'draft',
           rejection_reason = '', revision = revision + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).run(
      payload.project_id,
      payload.phase_id,
      payload.task_id,
      payload.report_date,
      payload.weather,
      payload.temperature_c,
      payload.site_condition,
      payload.work_done,
      payload.observations,
      payload.incidents,
      id
    );
    db.prepare('DELETE FROM site_report_workforce WHERE report_id = ?').run(id);
    db.prepare('DELETE FROM site_report_equipment WHERE report_id = ?').run(id);
    db.prepare('DELETE FROM site_report_materials WHERE report_id = ?').run(id);
    insertSiteReportChildren(db, id, payload);
  }).immediate();
  logAudit(req.user!, 'UPDATE', 'site_report', id, existing.status, `Rapport ${existing.report_number} modifié`);
  res.json(loadSiteReport(id));
});

router.post('/site-reports/:id/submit', requireAuth, requirePermission('sites:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM site_reports WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Rapport de chantier introuvable.' });
    return;
  }
  if (!['draft', 'rejected'].includes(existing.status)) {
    res.status(400).json({ error: 'Seul un rapport en brouillon ou refusé peut être soumis à validation.' });
    return;
  }
  if (!String(existing.work_done || '').trim()) {
    res.status(400).json({ error: 'Le travail réalisé doit être renseigné avant la soumission.' });
    return;
  }
  db.prepare(
    `UPDATE site_reports SET status = 'submitted', submitted_by = ?, submitted_at = datetime('now'),
       rejection_reason = '', revision = revision + 1, updated_at = datetime('now') WHERE id = ?`
  ).run(req.user!.id, id);
  logAudit(req.user!, 'SUBMIT', 'site_report', id, existing.status, 'Soumis à validation');
  res.json(loadSiteReport(id));
});

router.post('/site-reports/:id/approve', requireAuth, requirePermission('sites:approve'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM site_reports WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Rapport de chantier introuvable.' });
    return;
  }
  if (existing.status !== 'submitted') {
    res.status(400).json({ error: 'Seul un rapport soumis peut être validé.' });
    return;
  }
  db.prepare(
    `UPDATE site_reports SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now'),
       rejection_reason = '', revision = revision + 1, updated_at = datetime('now') WHERE id = ?`
  ).run(req.user!.id, id);
  logAudit(req.user!, 'APPROVE', 'site_report', id, 'submitted', 'Rapport validé');
  res.json(loadSiteReport(id));
});

router.post('/site-reports/:id/reject', requireAuth, requirePermission('sites:approve'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM site_reports WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Rapport de chantier introuvable.' });
    return;
  }
  if (existing.status !== 'submitted') {
    res.status(400).json({ error: 'Seul un rapport soumis peut être refusé.' });
    return;
  }
  const reason = String(req.body?.reason || '').trim();
  if (!reason || reason.length > 1000) {
    res.status(400).json({ error: 'Indiquez un motif de refus (1 000 caractères maximum).' });
    return;
  }
  db.prepare(
    `UPDATE site_reports SET status = 'rejected', reviewed_by = ?, reviewed_at = datetime('now'),
       rejection_reason = ?, revision = revision + 1, updated_at = datetime('now') WHERE id = ?`
  ).run(req.user!.id, reason, id);
  logAudit(req.user!, 'REJECT', 'site_report', id, 'submitted', reason);
  res.json(loadSiteReport(id));
});

router.delete('/site-reports/:id', requireAuth, requirePermission('sites:write'), (req: AuthedRequest, res) => {
  const id = Number(req.params.id);
  const db = getDb();
  const existing = db.prepare('SELECT * FROM site_reports WHERE id = ?').get(id) as any;
  if (!existing) {
    res.status(404).json({ error: 'Rapport de chantier introuvable.' });
    return;
  }
  if (existing.status !== 'draft') {
    res.status(400).json({ error: 'Un rapport soumis, validé ou refusé ne peut pas être supprimé : conservez la trace du chantier.' });
    return;
  }
  db.prepare('DELETE FROM site_reports WHERE id = ?').run(id);
  logAudit(req.user!, 'DELETE', 'site_report', id, existing.report_number, 'Brouillon supprimé');
  res.json({ ok: true });
});

export default router;
