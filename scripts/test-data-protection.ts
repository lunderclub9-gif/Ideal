import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gestionpro-data-protection-'));
process.env.IDEAL_DATA_DIR = path.join(tempRoot, 'data');
process.env.GESTIONPRO_DATA_DIR = path.join(tempRoot, 'data');

const { getDb, closeDb, DOCS_DIR } = await import('../server/db.ts');
const { createFullBackup, getBackupHealth, listBackups, restoreFromZip, runStartupIntegrityCheck, saveBackupSettings, verifyBackupArchive } = await import('../server/backup.ts');
const { hashPassword, createSessionToken, verifySessionToken } = await import('../server/auth.ts');

try {
  const companyName = () => (getDb().prepare('SELECT name FROM company_settings WHERE id = 1').get() as { name: string } | undefined)?.name;
  const db = getDb();
  db.prepare("INSERT INTO company_settings (id, name, legal_form) VALUES (1, 'Entreprise de test', 'SARL')").run();
  const userId = Number(db.prepare(
    "INSERT INTO users (name, username, password_hash, role, status) VALUES (?, ?, ?, 'admin', 'active')"
  ).run('Test Admin', 'testadmin', hashPassword('Strong-Test-Password-2026')).lastInsertRowid);

  const user = { id: userId, name: 'Test Admin', username: 'testadmin', role: 'admin' as const, status: 'active' };
  const token = createSessionToken(user);
  assert.equal(verifySessionToken(token)?.id, userId, 'fresh session token should verify');
  assert.equal(verifySessionToken(`${token.slice(0, -1)}x`), null, 'tampered session token must be rejected');

  fs.mkdirSync(path.join(DOCS_DIR, 'General'), { recursive: true });
  fs.writeFileSync(path.join(DOCS_DIR, 'General', 'test-document.txt'), 'original document content', 'utf8');

  const backup = createFullBackup('manual_local', 'test-suite');
  const verified = verifyBackupArchive(backup.file_path);
  assert.equal(verified.verified, true);
  assert.equal(verified.documentCount, 1);

  db.prepare("UPDATE company_settings SET name = 'Modified after backup' WHERE id = 1").run();
  fs.writeFileSync(path.join(DOCS_DIR, 'General', 'test-document.txt'), 'modified document content', 'utf8');

  const restored = restoreFromZip(fs.readFileSync(backup.file_path), 'test-suite');
  assert.ok(restored.safetyBackup.file_name, 'restore must create a pre-restore safety archive');
  assert.equal(restored.restoredDocs, 1);
  assert.equal(companyName(), 'Entreprise de test');
  assert.equal(fs.readFileSync(path.join(DOCS_DIR, 'General', 'test-document.txt'), 'utf8'), 'original document content');

  const liveName = companyName();
  const corruptZip = new AdmZip(backup.file_path);
  const manifest = JSON.parse(corruptZip.getEntry('manifest.json')!.getData().toString('utf8'));
  manifest.db_sha256 = '0'.repeat(64);
  corruptZip.updateFile('manifest.json', Buffer.from(JSON.stringify(manifest), 'utf8'));
  assert.throws(() => restoreFromZip(corruptZip.toBuffer(), 'test-suite'), /SHA-256/);
  assert.equal(companyName(), liveName);

  const traversalZip = new AdmZip(backup.file_path);
  traversalZip.addFile('Documents/../../outside.txt', Buffer.from('not allowed'));
  assert.throws(() => restoreFromZip(traversalZip.toBuffer(), 'test-suite'), /inattendu|chemin|Chemin/);
  assert.equal(companyName(), liveName);

  // -------- Durability: startup integrity, external copy, rotation and health --------
  const integrity = runStartupIntegrityCheck();
  assert.equal(integrity.ok, true, 'startup integrity check accepts a healthy database');
  const freshHealth = getBackupHealth();
  assert.equal(freshHealth.integrity_ok, true, 'health exposes the startup integrity result');
  assert.ok(freshHealth.integrity_checked_at, 'the integrity check is timestamped');
  assert.equal(freshHealth.external_configured, false, 'no copy folder is configured by default');

  const externalDir = path.join(tempRoot, 'oneDrive-sync');
  fs.mkdirSync(externalDir, { recursive: true });
  const savedSettings = saveBackupSettings({ external_dir: externalDir, keep_manual: 3, warn_after_days: 1 });
  assert.equal(savedSettings.externalDir, externalDir, 'the copy folder is stored');

  const externalBackup = createFullBackup('manual_local', 'test-suite');
  assert.ok(externalBackup.external_path, 'the archive is copied to the external folder');
  assert.equal(path.dirname(String(externalBackup.external_path)), externalDir, 'the copy lands in the chosen folder');
  assert.ok(fs.existsSync(String(externalBackup.external_path)), 'the external copy exists on disk');
  assert.equal(fs.statSync(String(externalBackup.external_path)).size, externalBackup.size_bytes, 'the external copy is complete');

  const copiedHealth = getBackupHealth();
  assert.equal(copiedHealth.external_ok, true, 'health reports a successful external copy');
  assert.equal(copiedHealth.stale, false, 'a fresh backup is not stale');

  assert.throws(() => saveBackupSettings({ external_dir: path.join(tempRoot, 'absent') }), /introuvable/);
  assert.throws(() => saveBackupSettings({ external_dir: 'copie-relative' }), /chemin complet/);

  // A folder that disappears after being configured must not break the backup itself.
  // The restore above reopened the database, so the handle must be fetched again.
  getDb().prepare('UPDATE company_settings SET backup_external_dir = ? WHERE id = 1').run(path.join(tempRoot, 'gone'));
  const offlineBackup = createFullBackup('manual_local', 'test-suite');
  assert.equal(offlineBackup.external_path || null, null, 'a missing copy folder leaves the local archive valid');
  assert.equal(getBackupHealth().external_ok, false, 'health reports the missing external copy');
  getDb().prepare('UPDATE company_settings SET backup_external_dir = ? WHERE id = 1').run(externalDir);

  // Rotation keeps the newest archives and deletes both the local file and its copy.
  saveBackupSettings({ external_dir: externalDir, keep_manual: 1 });
  const beforeRotation = listBackups().filter((entry) => entry.backup_type === 'manual_local');
  assert.ok(beforeRotation.length >= 2, 'several manual archives exist before rotation');
  const newestKept = createFullBackup('manual_local', 'test-suite');
  const afterRotation = listBackups().filter((entry) => entry.backup_type === 'manual_local');
  assert.equal(afterRotation.length, 1, 'rotation keeps only the configured number of manual archives');
  assert.equal(afterRotation[0].id, newestKept.id, 'rotation keeps the newest archive');
  for (const removed of beforeRotation.filter((entry) => entry.id !== newestKept.id)) {
    assert.equal(fs.existsSync(removed.file_path), false, 'rotated local archive file is deleted');
    if (removed.external_path) {
      assert.equal(fs.existsSync(String(removed.external_path)), false, 'rotated external copy is deleted too');
    }
  }

  console.log('DATA_PROTECTION_TESTS_OK: backup, SHA-256 verification, restore, path rejection, startup integrity, external copy, rotation and staleness health.');
} finally {
  closeDb();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
