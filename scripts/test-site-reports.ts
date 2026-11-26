import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import Database from 'better-sqlite3';

// Isolated suite for the daily site report module (journal de chantier):
// schema 13, CRUD, per-day uniqueness, workforce/equipment/materials rows,
// submit → approve/reject workflow, permissions, optimistic concurrency,
// numbering and audit trail. Uses a temporary data directory only.

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideal-site-reports-'));
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

function isoDay(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

let exitCode = 0;
try {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Site report server startup timed out.')), 60000);
    server.stdout.on('data', (chunk) => {
      if (chunk.toString().includes('IDEAL_SERVER_READY')) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on('data', (chunk) => process.stderr.write('[site-reports-server] ' + chunk.toString()));
    server.once('exit', (code) => {
      if (!ready) {
        clearTimeout(timeout);
        reject(new Error(`Site report server exited before readiness (code ${code}).`));
      }
    });
  });

  let r = await request('/auth/setup', 'POST', {
    companyName: 'IDEAL Chantier SARL',
    legalForm: 'SARL',
    fullName: 'Admin Chantier',
    username: 'site_admin',
    password: 'Site-Reports-Password-2026',
  });
  assert.equal(r.status, 201, 'isolated first-run setup');
  const adminToken = r.data.token as string;
  assert.ok(adminToken, 'setup returns a session token');

  // -------- Reference records --------
  r = await request('/clients', 'POST', { name: 'Client Chantier SARL', address: 'Zone industrielle, Blida' }, adminToken);
  assert.equal(r.status, 201, 'client created');
  const clientId = Number(r.data.id);

  r = await request('/projects', 'POST', {
    client_id: clientId,
    title: 'Réalisation d’un bâtiment R+2',
    address: 'Cité 200 logements, Blida',
    start_date: isoDay(-5),
  }, adminToken);
  assert.equal(r.status, 201, 'project created');
  const projectId = Number(r.data.id);

  r = await request(`/projects/${projectId}/phases`, 'POST', { name: 'Gros œuvre', sort_order: 1 }, adminToken);
  assert.equal(r.status, 201, 'phase created');
  const phaseId = Number(r.data.id);

  r = await request(`/projects/${projectId}/tasks`, 'POST', { title: 'Coulage dalle niveau 1', phase_id: phaseId }, adminToken);
  assert.equal(r.status, 201, 'task created');
  const taskId = Number(r.data.id);

  r = await request('/workers', 'POST', {
    full_name: 'Karim Benali',
    job_title: 'Maçon',
    wage_type: 'daily',
    daily_wage: 4500,
    hire_date: '2024-01-15',
  }, adminToken);
  assert.equal(r.status, 201, 'worker created');
  const workerId = Number(r.data.id);

  r = await request('/materials', 'POST', {
    name: 'Ciment CEM II',
    code: 'CIM-001',
    category: 'Ciment & Liants',
    unit: 'Sac',
    current_quantity: 120,
    purchase_price: 720,
  }, adminToken);
  assert.equal(r.status, 201, 'material created');
  const materialId = Number(r.data.id);

  r = await request('/vehicles', 'POST', {
    asset_type: 'mixer',
    name: 'Bétonnière 350 L',
    registration: 'ENG-001',
  }, adminToken);
  assert.equal(r.status, 201, 'equipment created');
  const vehicleId = Number(r.data.id);

  const reportBody = {
    project_id: projectId,
    phase_id: phaseId,
    task_id: taskId,
    report_date: isoDay(0),
    weather: 'ensoleille',
    temperature_c: 27.5,
    site_condition: 'Accès dégagé, benne à gravats évacuée.',
    work_done: 'Coulage de la dalle du niveau 1 sur 85 m².',
    observations: 'Livraison de ciment retardée de deux heures.',
    incidents: 'Aucun incident.',
    workforce: [{ worker_id: workerId, hours_worked: 8, notes: 'Équipe maçonnerie' }],
    equipment: [{ vehicle_id: vehicleId, hours_used: 5.5, notes: '' }],
    materials: [{ material_id: materialId, quantity: 24, unit: 'Sac', notes: 'Dalle niveau 1' }],
  };

  // -------- Access control --------
  r = await request('/site-reports');
  assert.equal(r.status, 401, 'site report list requires authentication');

  // -------- Create and numbering --------
  r = await request('/site-reports', 'POST', reportBody, adminToken);
  assert.equal(r.status, 201, 'daily site report created');
  const reportId = Number(r.data.id);
  const year = new Date().getFullYear();
  assert.equal(r.data.report_number, `JC-${year}-0001`, 'first report uses the yearly JC sequence');
  assert.equal(r.data.status, 'draft', 'new report is a draft');
  assert.equal(r.data.workforce.length, 1, 'workforce row stored');
  assert.equal(r.data.equipment.length, 1, 'equipment row stored');
  assert.equal(r.data.materials.length, 1, 'material row stored');
  assert.equal(Number(r.data.total_hours), 8, 'total workforce hours computed');
  assert.equal(Number(r.data.total_equipment_hours), 5.5, 'total equipment hours computed');
  const firstRevision = Number(r.data.revision);

  r = await request('/site-reports', 'POST', { ...reportBody, work_done: 'Deuxième rapport du jour' }, adminToken);
  assert.equal(r.status, 409, 'a second report for the same project and day is refused');
  assert.match(r.data.error, /existe déjà/i, 'duplicate day message is explicit');

  r = await request('/site-reports', 'POST', { ...reportBody, report_date: '2026-02-31' }, adminToken);
  assert.equal(r.status, 400, 'impossible calendar date is refused');

  r = await request('/site-reports', 'POST', { ...reportBody, report_date: isoDay(-1), work_done: '   ' }, adminToken);
  assert.equal(r.status, 400, 'empty work description is refused');

  r = await request('/site-reports', 'POST', { ...reportBody, report_date: isoDay(-2), workforce: [{ worker_id: 999999, hours_worked: 8 }] }, adminToken);
  assert.equal(r.status, 400, 'unknown worker is refused');

  r = await request('/site-reports', 'POST', {
    ...reportBody,
    report_date: isoDay(-3),
    workforce: [{ worker_id: workerId, hours_worked: 8 }, { worker_id: workerId, hours_worked: 4 }],
  }, adminToken);
  assert.equal(r.status, 400, 'a worker cannot appear twice in one report');

  r = await request('/site-reports', 'POST', { ...reportBody, report_date: isoDay(-4), temperature_c: 120 }, adminToken);
  assert.equal(r.status, 400, 'out-of-range temperature is refused');

  // -------- Listing and filters --------
  r = await request('/site-reports?status=draft', 'GET', undefined, adminToken);
  assert.equal(r.status, 200, 'draft filter works');
  assert.ok(r.data.every((row: any) => row.status === 'draft'), 'draft filter only returns drafts');
  assert.ok(r.data.some((row: any) => row.id === reportId), 'created report is listed');

  r = await request(`/site-reports?project_id=${projectId}&from=${isoDay(-1)}&to=${isoDay(1)}`, 'GET', undefined, adminToken);
  assert.equal(r.status, 200, 'date range filter works');
  assert.ok(r.data.some((row: any) => row.id === reportId), 'report inside the range is returned');

  r = await request('/site-reports?from=2026-13-45', 'GET', undefined, adminToken);
  assert.equal(r.status, 400, 'invalid filter date is refused');

  r = await request(`/site-reports?q=${encodeURIComponent('dalle')}`, 'GET', undefined, adminToken);
  assert.ok(r.data.some((row: any) => row.id === reportId), 'text search finds the report');

  // -------- Options endpoint (permission scoped) --------
  r = await request(`/site-reports/options?project_id=${projectId}`, 'GET', undefined, adminToken);
  assert.equal(r.status, 200, 'options load for site reporters');
  assert.ok(r.data.projects.some((p: any) => p.id === projectId), 'project available in options');
  assert.ok(r.data.workers.some((w: any) => w.id === workerId), 'worker available in options');
  assert.ok(r.data.phases.some((p: any) => p.id === phaseId), 'project phases available in options');
  assert.ok(r.data.tasks.some((t: any) => t.id === taskId), 'project tasks available in options');

  // -------- Optimistic concurrency and update --------
  r = await request(`/site-reports/${reportId}`, 'PUT', { ...reportBody, revision: firstRevision + 99 }, adminToken);
  assert.equal(r.status, 409, 'stale revision is refused');

  r = await request(`/site-reports/${reportId}`, 'PUT', {
    ...reportBody,
    work_done: 'Coulage de la dalle du niveau 1 sur 90 m² (relevé corrigé).',
    revision: firstRevision,
  }, adminToken);
  assert.equal(r.status, 200, 'draft updated with matching revision');
  assert.equal(r.data.work_done.includes('90 m²'), true, 'work description updated');
  assert.equal(Number(r.data.revision), firstRevision + 1, 'revision increments on update');

  r = await request(`/site-reports/${reportId}`, 'PUT', { ...reportBody, project_id: 999999 }, adminToken);
  assert.equal(r.status, 400, 'unknown project is refused');

  // -------- Supervisor workflow --------
  r = await request('/users', 'POST', {
    name: 'Chef de chantier',
    username: 'site_foreman',
    password: 'Foreman-Password-2026',
    role: 'supervisor',
  }, adminToken);
  assert.equal(r.status, 201, 'supervisor user created');

  r = await request('/auth/login', 'POST', { username: 'site_foreman', password: 'Foreman-Password-2026' });
  assert.equal(r.status, 200, 'supervisor can sign in');
  const foremanToken = r.data.token as string;
  assert.ok((r.data.permissions as string[]).includes('sites:write'), 'supervisor has site report write permission');
  assert.ok(!(r.data.permissions as string[]).includes('sites:approve'), 'supervisor cannot approve site reports');

  r = await request('/site-reports', 'GET', undefined, foremanToken);
  assert.equal(r.status, 200, 'supervisor can read site reports');

  r = await request('/site-reports/options', 'GET', undefined, foremanToken);
  assert.equal(r.status, 200, 'supervisor can load options without the payroll permission');

  r = await request(`/site-reports/${reportId}/submit`, 'POST', {}, foremanToken);
  assert.equal(r.status, 200, 'supervisor submits the report');
  assert.equal(r.data.status, 'submitted', 'report is submitted');

  r = await request(`/site-reports/${reportId}`, 'PUT', { ...reportBody, revision: r.data.revision }, foremanToken);
  assert.equal(r.status, 400, 'a submitted report cannot be edited');

  r = await request(`/site-reports/${reportId}/approve`, 'POST', {}, foremanToken);
  assert.equal(r.status, 403, 'supervisor cannot approve a report');

  r = await request(`/site-reports/${reportId}/reject`, 'POST', { reason: '' }, adminToken);
  assert.equal(r.status, 400, 'rejection requires a reason');

  // -------- Reject, correct, resubmit, approve --------
  r = await request(`/site-reports/${reportId}/reject`, 'POST', { reason: 'Quantité de ciment à justifier.' }, adminToken);
  assert.equal(r.status, 200, 'admin rejects the submitted report');
  assert.equal(r.data.status, 'rejected', 'report is rejected');
  assert.equal(r.data.rejection_reason, 'Quantité de ciment à justifier.', 'rejection reason stored');

  r = await request(`/site-reports/${reportId}`, 'GET', undefined, adminToken);
  const rejectedRevision = Number(r.data.revision);

  r = await request(`/site-reports/${reportId}`, 'PUT', { ...reportBody, revision: rejectedRevision }, foremanToken);
  assert.equal(r.status, 200, 'rejected report can be corrected');
  assert.equal(r.data.status, 'draft', 'corrected report returns to draft');

  r = await request(`/site-reports/${reportId}/submit`, 'POST', {}, foremanToken);
  assert.equal(r.status, 200, 'corrected report resubmitted');

  r = await request(`/site-reports/${reportId}/approve`, 'POST', {}, adminToken);
  assert.equal(r.status, 200, 'admin approves the report');
  assert.equal(r.data.status, 'approved', 'report is approved');
  assert.equal(r.data.reviewed_by_name, 'Admin Chantier', 'reviewer recorded');

  r = await request(`/site-reports/${reportId}`, 'PUT', { ...reportBody }, adminToken);
  assert.equal(r.status, 400, 'an approved report cannot be edited');

  r = await request(`/site-reports/${reportId}`, 'DELETE', undefined, adminToken);
  assert.equal(r.status, 400, 'an approved report cannot be deleted');

  // -------- Draft deletion and sequence continuity --------
  r = await request('/site-reports', 'POST', { ...reportBody, report_date: isoDay(-6), work_done: 'Installation de chantier.' }, foremanToken);
  assert.equal(r.status, 201, 'second report created by the supervisor');
  assert.equal(r.data.report_number, `JC-${year}-0002`, 'numbering continues without reuse');
  const draftId = Number(r.data.id);

  r = await request(`/site-reports/${draftId}`, 'DELETE', undefined, foremanToken);
  assert.equal(r.status, 200, 'draft deleted by its author role');

  r = await request(`/site-reports/${draftId}`, 'GET', undefined, adminToken);
  assert.equal(r.status, 404, 'deleted draft is gone');

  // -------- Attachments link --------
  const form = new FormData();
  form.append('title', 'Photo de la dalle');
  form.append('category', 'Projects');
  form.append('doc_date', isoDay(0));
  form.append('related_type', 'site_report');
  form.append('related_id', String(reportId));
  form.append('file', new Blob([Buffer.from('photo-test')], { type: 'image/jpeg' }), 'dalle.jpg');
  const upload = await fetch(`${base}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: form,
  });
  assert.equal(upload.status, 201, 'attachment accepted for a site report');
  const attachment = await upload.json() as any;
  assert.equal(attachment.related_type, 'site_report', 'attachment linked to the report');
  assert.equal(Number(attachment.related_id), reportId, 'attachment points at the report id');

  r = await request(`/site-reports/${reportId}`, 'GET', undefined, adminToken);
  assert.ok(r.data.attachments.some((doc: any) => doc.id === Number(attachment.id)), 'report detail lists its attachments');

  const badForm = new FormData();
  badForm.append('title', 'Pièce orpheline');
  badForm.append('category', 'Projects');
  badForm.append('related_type', 'site_report');
  badForm.append('related_id', '999999');
  badForm.append('file', new Blob([Buffer.from('x')], { type: 'image/jpeg' }), 'x.jpg');
  const badUpload = await fetch(`${base}/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: badForm,
  });
  assert.equal(badUpload.status, 400, 'attachment for an unknown report is refused');

  // -------- Excel export --------
  const xlsx = await fetch(`${base}/site-reports/export/xlsx`, { headers: { Authorization: `Bearer ${adminToken}` } });
  assert.equal(xlsx.status, 200, 'site report export responds');
  assert.ok((xlsx.headers.get('content-type') || '').includes('spreadsheetml'), 'export is an xlsx workbook');

  // -------- Audit trail --------
  r = await request('/audit-logs', 'GET', undefined, adminToken);
  assert.equal(r.status, 200, 'audit log readable by admin');
  const siteAudit = (r.data as any[]).filter((row) => row.entity === 'site_report');
  assert.ok(siteAudit.some((row) => row.action === 'CREATE'), 'report creation audited');
  assert.ok(siteAudit.some((row) => row.action === 'SUBMIT'), 'report submission audited');
  assert.ok(siteAudit.some((row) => row.action === 'APPROVE'), 'report approval audited');
  assert.ok(siteAudit.some((row) => row.action === 'REJECT'), 'report rejection audited');

  // -------- Schema and foreign keys --------
  const dbFile = path.join(dataDir, 'gestionpro.db');
  const raw = new Database(dbFile, { readonly: true });
  const versions = (raw.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>).map((row) => row.version);
  assert.deepEqual(versions, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 'migration chain ends at schema 13');
  const integrity = raw.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
  assert.equal(integrity.integrity_check, 'ok', 'database integrity check is clean');
  const fkIssues = raw.prepare('PRAGMA foreign_key_check').all();
  assert.equal(fkIssues.length, 0, 'no foreign key violations');
  raw.close();

  console.log('Site report suite passed: schema 13, CRUD, uniqueness, workflow, permissions, revisions, attachments and audit.');
} catch (error) {
  exitCode = 1;
  console.error(error);
} finally {
  try {
    const dbFile = path.join(dataDir, 'gestionpro.db');
    if (fs.existsSync(dbFile) && !server.killed) {
      // keep the file closed by the server before cleanup
    }
  } catch {}
  await stopServer();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
process.exit(exitCode);
