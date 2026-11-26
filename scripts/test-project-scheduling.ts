/**
 * Verifies project task scheduling migration 12 and dependency integrity.
 * Uses an in-memory SQLite database; no customer data or repository files are modified.
 */
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';

const { LATEST_SCHEMA_VERSION, runMigrations } = await import('../server/db.ts');
const db = new Database(':memory:');
db.pragma('foreign_keys = ON');

try {
  runMigrations(db, 11);
  const beforeProjects = db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number };
  runMigrations(db, 12);
  assert.equal(LATEST_SCHEMA_VERSION, 12, 'the application must advertise schema 12');
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 12').get() as { count: number }).count,
    1,
    'migration 12 is recorded exactly once'
  );

  const client = db.prepare('INSERT INTO clients (name) VALUES (?)').run('Client planning');
  const projectA = db.prepare(
    'INSERT INTO projects (project_number, client_id, title, start_date) VALUES (?, ?, ?, ?)'
  ).run('PLAN-001', client.lastInsertRowid, 'Chantier planning A', '2026-01-01');
  const projectB = db.prepare(
    'INSERT INTO projects (project_number, client_id, title, start_date) VALUES (?, ?, ?, ?)'
  ).run('PLAN-002', client.lastInsertRowid, 'Chantier planning B', '2026-01-01');

  const addTask = db.prepare('INSERT INTO project_tasks (project_id, title) VALUES (?, ?)');
  const taskA = Number(addTask.run(projectA.lastInsertRowid, 'Fondations').lastInsertRowid);
  const taskB = Number(addTask.run(projectA.lastInsertRowid, 'Élévation').lastInsertRowid);
  const taskC = Number(addTask.run(projectA.lastInsertRowid, 'Toiture').lastInsertRowid);
  const foreignTask = Number(addTask.run(projectB.lastInsertRowid, 'Autre chantier').lastInsertRowid);

  const addDependency = db.prepare(
    'INSERT INTO project_task_dependencies (project_id, predecessor_task_id, successor_task_id) VALUES (?, ?, ?)'
  );
  const count = () => (db.prepare('SELECT COUNT(*) AS count FROM project_task_dependencies').get() as { count: number }).count;

  addDependency.run(projectA.lastInsertRowid, taskA, taskB);
  addDependency.run(projectA.lastInsertRowid, taskB, taskC);
  assert.equal(count(), 2, 'valid predecessor links are stored');

  assert.throws(() => addDependency.run(projectA.lastInsertRowid, taskA, taskB), /UNIQUE/i, 'duplicate links are rejected');
  assert.throws(() => addDependency.run(projectA.lastInsertRowid, taskA, taskA), /CHECK/i, 'self-dependencies are rejected');
  assert.throws(() => addDependency.run(projectA.lastInsertRowid, taskC, taskA), /cycle/i, 'dependency cycles are rejected');
  assert.throws(() => addDependency.run(projectA.lastInsertRowid, taskA, foreignTask), /same project|within one project/i, 'cross-project links are rejected');

  runMigrations(db, 12);
  assert.equal(count(), 2, 're-running the migration does not duplicate dependency data');
  assert.equal(
    (db.prepare('SELECT COUNT(*) AS count FROM projects').get() as { count: number }).count,
    beforeProjects.count + 2,
    'existing project records are retained while test projects are added'
  );

  db.prepare('DELETE FROM project_tasks WHERE id = ?').run(taskB);
  assert.equal(count(), 0, 'deleting a task cascades only its related dependency rows');
  assert.equal((db.pragma('foreign_key_check') as unknown[]).length, 0, 'the migration leaves valid foreign keys');

  console.log('PASS: project scheduling migration, dependency uniqueness, same-project integrity, cycle prevention, cascade and idempotency.');
} finally {
  db.close();
}
