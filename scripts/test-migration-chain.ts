/**
 * Runs the whole migration chain against a captured company database.
 *
 * A migration that loses one invoice is unrecoverable for a customer, so this test
 * takes a realistic schema-9 snapshot (tests/fixtures/company-legacy-v9.sql), migrates
 * it to the current version through the real startup path, and proves that every row,
 * every amount and every reference is still there. It also proves the build refuses a
 * database written by a newer version instead of writing into it.
 *
 * It never touches the committed fixture or a real data directory: everything happens
 * in a temporary copy. Run with `npm run test:migrations`.
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import Database from 'better-sqlite3';

const repoRoot = process.cwd();
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ideal-migrations-'));
const dataDir = path.join(tempRoot, 'legacy-company');
fs.mkdirSync(dataDir, { recursive: true });

process.env.IDEAL_DATA_DIR = dataDir;
process.env.GESTIONPRO_DATA_DIR = dataDir;

const { LATEST_SCHEMA_VERSION, closeDb, getDb, runMigrations } = await import('../server/db.ts');

const LEGACY_VERSION = 9;
const fixturePath = path.join(repoRoot, 'tests', 'fixtures', 'company-legacy-v9.sql');
const fixtureSql = fs.readFileSync(fixturePath, 'utf8');

const TABLES = [
  'users', 'clients', 'suppliers', 'materials', 'projects', 'project_phases', 'project_tasks',
  'contracts', 'contract_milestones', 'commercial_documents', 'commercial_lines', 'payments',
  'purchases', 'purchase_lines', 'stock_movements', 'workers', 'attendance', 'payroll_periods',
  'payslips', 'expenses', 'treasury_transactions', 'documents', 'audit_logs', 'backup_history',
  'boq_versions', 'boq_sections', 'boq_items', 'boq_item_resources',
];

const AMOUNTS: Array<[string, string]> = [
  ['commercial_documents', 'total_ht'],
  ['commercial_documents', 'total_tva'],
  ['commercial_documents', 'total_ttc'],
  ['commercial_documents', 'amount_paid'],
  ['commercial_lines', 'line_ttc'],
  ['payments', 'amount'],
  ['purchase_lines', 'line_total'],
  ['stock_movements', 'total_cost'],
  ['payslips', 'net_pay'],
  ['expenses', 'amount'],
  ['treasury_transactions', 'amount'],
  ['contract_milestones', 'expected_amount'],
  ['contract_milestones', 'received_amount'],
  ['boq_items', 'quantity'],
  ['boq_items', 'unit_price'],
  ['boq_item_resources', 'unit_cost'],
  ['projects', 'expected_selling_price'],
];

const money = (value: unknown) => Math.round(Number(value || 0) * 100) / 100;

function snapshot(db: Database.Database) {
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    counts[table] = (db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count;
  }
  const amounts: Record<string, number> = {};
  for (const [table, column] of AMOUNTS) {
    amounts[`${table}.${column}`] = money(
      (db.prepare(`SELECT COALESCE(SUM(${column}), 0) AS total FROM ${table}`).get() as { total: number }).total
    );
  }
  return { counts, amounts };
}

function columnsOf(db: Database.Database, table: string) {
  return (db.pragma(`table_info(${table})`) as Array<{ name: string }>).map((column) => column.name);
}

const results: string[] = [];
const check = (label: string) => results.push(label);

// 1. Rebuild the customer's database exactly as it looked at schema 9.
const dbPath = path.join(dataDir, 'gestionpro.db');
const legacy = new Database(dbPath);
legacy.pragma('foreign_keys = ON');
runMigrations(legacy, LEGACY_VERSION);
const legacyVersion = (legacy.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as { version: number }).version;
assert.equal(legacyVersion, LEGACY_VERSION, `the captured fixture must load at schema ${LEGACY_VERSION}`);
legacy.exec(fixtureSql);
assert.equal((legacy.pragma('foreign_key_check') as unknown[]).length, 0, 'the captured fixture itself has valid references');
const before = snapshot(legacy);
assert.ok(before.counts.commercial_documents >= 5, 'the captured company has its invoices');
assert.ok(before.amounts['commercial_documents.total_ttc'] > 0, 'the captured company has billed amounts');
legacy.close();
check(`fixture loaded at schema ${LEGACY_VERSION}`);

// 2. Open it the way the application does: the full chain must run to the current version.
const db = getDb();
const appliedVersions = (db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>)
  .map((row) => row.version);
assert.deepEqual(
  appliedVersions,
  Array.from({ length: LATEST_SCHEMA_VERSION }, (_, index) => index + 1),
  'the chain applies every migration exactly once'
);
assert.equal(
  Math.max(...appliedVersions),
  LATEST_SCHEMA_VERSION,
  'LATEST_SCHEMA_VERSION must be bumped whenever a migration is added, otherwise newer databases are accepted'
);
check(`chain ${appliedVersions[0]}→${LATEST_SCHEMA_VERSION} applied`);

// 3. Nothing was lost: same rows, same money.
const after = snapshot(db);
for (const table of TABLES) {
  assert.equal(after.counts[table], before.counts[table], `${table} kept every row through the migration chain`);
}
for (const [table, column] of AMOUNTS) {
  assert.equal(after.amounts[`${table}.${column}`], before.amounts[`${table}.${column}`], `${table}.${column} is unchanged by the migration chain`);
}
check(`all ${TABLES.length} tables and ${AMOUNTS.length} amount columns preserved`);

// 4. The specific facts a customer would notice are still readable and correct.
const invoice = db.prepare("SELECT total_ttc, amount_paid, status, locked_at FROM commercial_documents WHERE doc_number = 'FAC-2025-0001'").get() as any;
assert.equal(invoice.total_ttc, 2380000);
assert.equal(invoice.amount_paid, 2380000);
assert.equal(invoice.status, 'paid');
assert.ok(invoice.locked_at, 'the locked invoice stays locked');
const project = db.prepare("SELECT progress_percent, expected_selling_price FROM projects WHERE project_number = 'CH-2025-0001'").get() as any;
assert.equal(project.progress_percent, 62);
assert.equal(project.expected_selling_price, 8500000);
const boq = db.prepare('SELECT SUM(quantity * unit_price) AS total FROM boq_items WHERE version_id = 1').get() as any;
assert.equal(boq.total, 5763000, 'the priced BOQ schedule survives intact');
const payroll = db.prepare('SELECT COUNT(*) AS count, SUM(net_pay) AS net FROM payslips WHERE payroll_period_id = 1').get() as any;
assert.equal(payroll.count, 3);
assert.equal(payroll.net, 171904);
const cash = db.prepare("SELECT COUNT(*) AS count FROM treasury_transactions WHERE account = 'Caisse'").get() as any;
assert.equal(cash.count, 3);
check('invoice, project, BOQ, payroll and cash facts preserved');

// 5. The database is structurally sound after the chain.
assert.equal((db.prepare('PRAGMA integrity_check').get() as any).integrity_check, 'ok', 'integrity_check is ok after the migration chain');
assert.equal((db.pragma('foreign_key_check') as unknown[]).length, 0, 'foreign_key_check reports no orphan row after the migration chain');
check('integrity_check and foreign_key_check clean');

// 6. The columns and tables added by the newer migrations exist, and old rows got sane defaults.
for (const table of ['commercial_documents', 'payments', 'payslips', 'payroll_periods']) {
  assert.ok(columnsOf(db, table).includes('revision'), `${table}.revision was added by migration 10`);
  const missing = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE revision IS NULL`).get() as { count: number };
  assert.equal(missing.count, 0, `${table}.revision is filled on every existing row`);
}
for (const column of ['backup_external_dir', 'backup_keep_manual', 'backup_warn_after_days']) {
  assert.ok(columnsOf(db, 'company_settings').includes(column), `company_settings.${column} was added by migration 11`);
}
for (const column of ['external_path', 'external_copied_at']) {
  assert.ok(columnsOf(db, 'backup_history').includes(column), `backup_history.${column} was added by migration 11`);
}
const settings = db.prepare('SELECT backup_external_dir, backup_keep_manual, backup_warn_after_days FROM company_settings WHERE id = 1').get() as any;
assert.equal(settings.backup_external_dir, '', 'an existing company starts with no copy folder, not a broken one');
assert.equal(settings.backup_keep_manual, 10);
assert.equal(settings.backup_warn_after_days, 2);
check('new columns present with defaults on existing rows');

// 7. Reopening does not re-run anything or duplicate data.
closeDb();
const reopened = getDb();
const reopenedSnapshot = snapshot(reopened);
assert.deepEqual(reopenedSnapshot.counts, after.counts, 'a second start keeps the same rows');
assert.deepEqual(reopenedSnapshot.amounts, after.amounts, 'a second start keeps the same amounts');
assert.equal((reopened.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get() as any).count, LATEST_SCHEMA_VERSION);
check('second start is idempotent');

// 8. A database written by a newer IDEAL must be refused, untouched.
const newerDir = path.join(tempRoot, 'newer-company');
fs.mkdirSync(newerDir, { recursive: true });
const newerPath = path.join(newerDir, 'gestionpro.db');
const newer = new Database(newerPath);
newer.exec(`
  CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')));
  CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, username TEXT NOT NULL UNIQUE);
  INSERT INTO users (name, username) VALUES ('Utilisateur récent', 'recent');
`);
newer.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(LATEST_SCHEMA_VERSION + 1);
newer.close();

const workerPath = path.join(tempRoot, 'open-newer-database.ts');
fs.writeFileSync(
  workerPath,
  `import { getDb } from ${JSON.stringify(pathToFileURL(path.join(repoRoot, 'server', 'db.ts')).href)};\n` +
    `try {\n` +
    `  getDb();\n` +
    `  console.log('UNEXPECTED_OPEN');\n` +
    `} catch (error) {\n` +
    `  const message = String((error as Error)?.message || error);\n` +
    `  console.log(message.includes('version plus récente') ? 'NEWER_REFUSED: ' + message : 'UNEXPECTED_ERROR: ' + message);\n` +
    `}\n`
);
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const child = spawnSync(process.execPath, [tsxCli, workerPath], {
  env: { ...process.env, IDEAL_DATA_DIR: newerDir, GESTIONPRO_DATA_DIR: newerDir },
  encoding: 'utf8',
  timeout: 120000,
});
const childOutput = `${child.stdout || ''}${child.stderr || ''}`;
assert.equal(child.status, 0, `the newer-version probe must exit cleanly: ${childOutput}`);
assert.ok(childOutput.includes('NEWER_REFUSED'), `the app must refuse a newer database: ${childOutput}`);
assert.ok(childOutput.includes(String(LATEST_SCHEMA_VERSION + 1)), 'the refusal names the version found on disk');
assert.ok(childOutput.includes(String(LATEST_SCHEMA_VERSION)), 'the refusal names the version this build supports');

const untouched = new Database(newerPath, { readonly: true });
const untouchedVersions = (untouched.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as Array<{ version: number }>)
  .map((row) => row.version);
assert.deepEqual(untouchedVersions, [LATEST_SCHEMA_VERSION + 1], 'the refused database keeps its own schema history');
assert.equal((untouched.prepare('SELECT COUNT(*) AS count FROM users').get() as any).count, 1, 'the refused database keeps its data');
untouched.close();
check('newer database refused and left untouched');

closeDb();
fs.rmSync(tempRoot, { recursive: true, force: true });

console.log(`MIGRATION_CHAIN_TESTS_OK: ${results.join('; ')}.`);
