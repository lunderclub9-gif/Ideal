import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gestionpro-data-protection-'));
process.env.IDEAL_DATA_DIR = path.join(tempRoot, 'data');
process.env.GESTIONPRO_DATA_DIR = path.join(tempRoot, 'data');

const { getDb, closeDb, DOCS_DIR } = await import('../server/db.ts');
const { createFullBackup, verifyBackupArchive, restoreFromZip } = await import('../server/backup.ts');
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

  console.log('DATA_PROTECTION_TESTS_OK: backup, SHA-256 verification, restore, session signature and archive path rejection.');
} finally {
  closeDb();
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
