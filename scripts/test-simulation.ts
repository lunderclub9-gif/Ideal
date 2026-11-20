import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideal-simulation-'));
const dataDir = path.join(tempRoot, 'isolated-company-data');
const port = await new Promise<number>((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const address = probe.address();
    if (!address || typeof address === 'string') return reject(new Error('Could not reserve an isolated test port.'));
    const selected = address.port;
    probe.close((error) => error ? reject(error) : resolve(selected));
  });
});

const env = {
  ...process.env,
  IDEAL_DATA_DIR: dataDir,
  GESTIONPRO_DATA_DIR: dataDir,
  HOST: '127.0.0.1',
  PORT: String(port),
  NODE_ENV: 'development',
};
const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs');
const server = spawn(process.execPath, [tsxCli, 'server.ts'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
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
    const timeout = setTimeout(() => reject(new Error('Isolated IDEAL simulation server startup timed out.')), 45000);
    server.stdout.on('data', (chunk) => {
      const output = chunk.toString();
      if (output.includes('IDEAL_SERVER_READY')) {
        ready = true;
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on('data', (chunk) => process.stderr.write('[simulation-server] ' + chunk.toString()));
    server.once('exit', (code) => {
      if (!ready) {
        clearTimeout(timeout);
        reject(new Error(`Isolated IDEAL server exited before readiness (code ${code}).`));
      }
    });
  });

  let result = await request('/auth/setup', 'POST', {
    companyName: 'IDEAL Simulation SARL',
    legalForm: 'SARL',
    fullName: 'Simulation Admin',
    username: 'simulation_admin',
    password: 'Simulation-Password-2026',
  });
  assert.equal(result.status, 201, 'isolated first-run setup');
  const token = result.data.token as string;
  assert.ok(token, 'setup must return an authentication token');

  result = await request('/dashboard', 'GET', undefined, token);
  assert.equal(result.status, 200, 'dashboard loads after setup');

  result = await request('/clients', 'POST', { name: 'Simulation Client' }, token);
  assert.equal(result.status, 201, 'create client');
  const clientId = Number(result.data.id);
  assert.ok(result.data.deletion_eligible_until, 'new client gets seven-day eligibility');

  result = await request('/projects', 'POST', { title: 'Simulation Project', client_id: clientId }, token);
  assert.equal(result.status, 201, 'create project');
  const projectId = Number(result.data.id);
  assert.ok(result.data.deletion_eligible_until, 'new project gets seven-day eligibility');

  const today = new Date().toISOString().slice(0, 10);
  result = await request('/workers', 'POST', {
    full_name: 'Simulation Worker',
    job_title: 'Technicien',
    wage_type: 'daily',
    daily_wage: 5000,
    hire_date: today,
    status: 'active',
  }, token);
  assert.equal(result.status, 201, 'create worker');
  const workerId = Number(result.data.id);
  assert.ok(result.data.deletion_eligible_until, 'new worker gets seven-day eligibility');

  result = await request('/attendance', 'POST', {
    attendance_date: today,
    worker_id: workerId,
    project_id: projectId,
    status: 'present',
    day_fraction: 1,
    overtime_hours: 0,
    advance_amount: 0,
    notes: 'Simulation only',
  }, token);
  assert.equal(result.status, 201, 'record worker attendance');

  result = await request('/commercial-documents', 'POST', {
    doc_type: 'facture',
    client_id: clientId,
    project_id: projectId,
    issue_immediately: true,
    lines: [{ description: 'Prestation de simulation', quantity: 1, unit_price: 10000, tva_rate: 19 }],
  }, token);
  assert.equal(result.status, 201, 'issue invoice');
  assert.ok(result.data.deletion_eligible_until, 'invoice creation metadata is present');

  result = await request('/expenses', 'POST', {
    category: 'Test',
    description: 'Simulation expense',
    amount: 500,
    payment_method: 'Espèces',
    project_id: projectId,
    notes: 'Temporary isolated test record',
  }, token);
  assert.equal(result.status, 201, 'create expense with treasury movement');

  result = await request('/lifecycle/overview', 'GET', undefined, token);
  assert.equal(result.status, 200, 'lifecycle overview loads');
  const records = result.data as any[];
  for (const [table, id] of [
    ['clients', clientId],
    ['projects', projectId],
    ['workers', workerId],
    ['commercial_documents', Number((await request('/commercial-documents', 'GET', undefined, token)).data?.[0]?.id || 0)],
  ]) {
    assert.ok(records.some((row) => row.table === table && row.id === id), `lifecycle overview includes ${table} #${id}`);
  }

  result = await request('/backups/create', 'POST', { backup_type: 'manual_local' }, token);
  assert.equal(result.status, 201, 'create isolated verified backup');
  assert.equal(result.data.verified, true, 'backup is verified');

  assert.ok(fs.existsSync(path.join(dataDir, 'gestionpro.db')), 'database is created inside the unique temporary directory');
  assert.ok(path.resolve(dataDir).startsWith(path.resolve(tempRoot)), 'database path is contained by the unique temporary directory');

  console.log('SIMULATION_TESTS_OK: setup, dashboard, client, project, worker, attendance, invoice, expense/treasury, lifecycle overview and verified backup.');
  console.log('SIMULATION_DATA_ISOLATED:', dataDir);
} catch (error: any) {
  console.error('SIMULATION_TESTS_FAILED:', error?.stack || error);
  process.exitCode = 1;
} finally {
  await stopServer();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
