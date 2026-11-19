import AdmZip from 'adm-zip';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { BACKUPS_DIR, closeDb, DB_PATH, DOCS_DIR, ensureDirectories, getDb, reopenDb } from './db.ts';
import { logAudit } from './auth.ts';

export interface BackupEntry {
  id: number;
  file_name: string;
  file_path: string;
  backup_type: 'auto_daily' | 'manual_local' | 'usb_export' | 'pre_restore_safety';
  size_bytes: number;
  verified: number;
  created_by: string;
  created_at: string;
}

function sha256Buffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function collectFilesRecursive(dir: string, baseDir: string): Array<{ relPath: string; absPath: string }> {
  const results: Array<{ relPath: string; absPath: string }> = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(absPath, baseDir));
    } else if (entry.isFile()) {
      results.push({ relPath: path.relative(baseDir, absPath).split(path.sep).join('/'), absPath });
    }
  }
  return results;
}

function verifySqliteSnapshot(snapshotPath: string) {
  const testDb = new Database(snapshotPath, { readonly: true });
  try {
    const row = testDb.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
    if (!row || row.integrity_check !== 'ok') {
      throw new Error(`Vérification d’intégrité SQLite échouée : ${row?.integrity_check || 'inconnue'}`);
    }
  } finally {
    testDb.close();
  }
}

export function createFullBackup(
  backupType: 'auto_daily' | 'manual_local' | 'usb_export' | 'pre_restore_safety',
  createdBy: string
): BackupEntry {
  ensureDirectories();
  const db = getDb();
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const tempSnapshot = path.join(BACKUPS_DIR, `.snapshot-${stamp}-${process.pid}.db`);
  if (fs.existsSync(tempSnapshot)) fs.unlinkSync(tempSnapshot);

  // Atomic consistent snapshot via VACUUM INTO
  const escapedSnapshot = tempSnapshot.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escapedSnapshot}'`);
  verifySqliteSnapshot(tempSnapshot);

  const dbBytes = fs.readFileSync(tempSnapshot);
  const dbSha = sha256Buffer(dbBytes);
  const docFiles = collectFilesRecursive(DOCS_DIR, DOCS_DIR);

  const zip = new AdmZip();
  zip.addFile('gestionpro.db', dbBytes);
  for (const doc of docFiles) {
    zip.addFile(`Documents/${doc.relPath}`, fs.readFileSync(doc.absPath));
  }

  const manifest = {
    app: 'GestionPro DZ',
    schema_version: 1,
    backup_type: backupType,
    created_at: now.toISOString(),
    created_by: createdBy,
    db_sha256: dbSha,
    document_count: docFiles.length,
    integrity_check: 'ok',
  };
  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));

  const fileName = `gestionpro-dz-${stamp}-${backupType}.zip`;
  const filePath = path.join(BACKUPS_DIR, fileName);
  zip.writeZip(filePath);
  fs.unlinkSync(tempSnapshot);

  const sizeBytes = fs.statSync(filePath).size;
  const info = db
    .prepare(
      `INSERT INTO backup_history (file_name, file_path, backup_type, size_bytes, verified, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`
    )
    .run(fileName, filePath, backupType, sizeBytes, createdBy);

  if (backupType === 'auto_daily') {
    pruneOldDailyBackups();
  }

  return db.prepare('SELECT * FROM backup_history WHERE id = ?').get(info.lastInsertRowid) as BackupEntry;
}

export function pruneOldDailyBackups() {
  const db = getDb();
  const settings = db.prepare('SELECT auto_backup_keep_daily FROM company_settings WHERE id = 1').get() as
    | { auto_backup_keep_daily?: number }
    | undefined;
  const keepCount = Math.max(1, Number(settings?.auto_backup_keep_daily ?? 30));

  const dailies = db
    .prepare("SELECT id, file_path FROM backup_history WHERE backup_type = 'auto_daily' ORDER BY id DESC")
    .all() as Array<{ id: number; file_path: string }>;

  if (dailies.length <= keepCount) return;
  for (const old of dailies.slice(keepCount)) {
    try {
      if (fs.existsSync(old.file_path)) fs.unlinkSync(old.file_path);
    } catch {
      // Ignore missing file on disk
    }
    db.prepare('DELETE FROM backup_history WHERE id = ?').run(old.id);
  }
}

export function listBackups(): BackupEntry[] {
  const db = getDb();
  return db.prepare('SELECT * FROM backup_history ORDER BY id DESC LIMIT 100').all() as BackupEntry[];
}

export function restoreFromZip(
  zipBuffer: Buffer,
  restoredBy: string
): { safetyBackup: BackupEntry; restoredDocs: number } {
  ensureDirectories();
  const zip = new AdmZip(zipBuffer);
  const dbEntry = zip.getEntry('gestionpro.db');
  if (!dbEntry) {
    throw new Error('Archive invalide : le fichier gestionpro.db est introuvable dans le ZIP.');
  }

  const dbBuf = dbEntry.getData();
  const manifestEntry = zip.getEntry('manifest.json');
  if (manifestEntry) {
    try {
      const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
      if (manifest.db_sha256 && sha256Buffer(dbBuf) !== manifest.db_sha256) {
        throw new Error('L’empreinte SHA-256 de la base de données ne correspond pas au manifeste.');
      }
    } catch (err: any) {
      if (err.message?.includes('SHA-256')) throw err;
      throw new Error('Manifeste manifest.json corrompu dans l’archive.');
    }
  }

  // Validate SQLite integrity before touching live database
  const tempCheck = path.join(BACKUPS_DIR, `.restore-check-${Date.now()}.db`);
  fs.writeFileSync(tempCheck, dbBuf);
  try {
    verifySqliteSnapshot(tempCheck);
  } finally {
    if (fs.existsSync(tempCheck)) fs.unlinkSync(tempCheck);
  }

  // Mandatory safety backup before overwriting live DB
  const safetyBackup = createFullBackup('pre_restore_safety', restoredBy);

  closeDb();
  for (const suffix of ['', '-wal', '-shm']) {
    const p = `${DB_PATH}${suffix}`;
    if (fs.existsSync(p)) {
      fs.unlinkSync(p);
    }
  }
  fs.writeFileSync(DB_PATH, dbBuf);

  // Restore embedded Documents/ folder cleanly without path traversal
  let restoredDocs = 0;
  for (const entry of zip.getEntries()) {
    if (!entry.isDirectory && entry.entryName.startsWith('Documents/')) {
      const rel = entry.entryName.slice('Documents/'.length);
      const target = path.resolve(DOCS_DIR, rel);
      if (target.startsWith(DOCS_DIR + path.sep)) {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, entry.getData());
        restoredDocs++;
      }
    }
  }

  const db = reopenDb();
  // Ensure pre-restore safety backup record remains visible in history after restore
  db.prepare(
    `INSERT OR IGNORE INTO backup_history (file_name, file_path, backup_type, size_bytes, verified, created_by)
     VALUES (?, ?, 'pre_restore_safety', ?, 1, ?)`
  ).run(safetyBackup.file_name, safetyBackup.file_path, safetyBackup.size_bytes, restoredBy);

  logAudit(
    { id: 0, name: restoredBy, username: restoredBy, role: 'admin' },
    'RESTORE',
    'database',
    safetyBackup.file_name,
    '',
    `Restauration ZIP vérifiée (${restoredDocs} document(s))`
  );

  return { safetyBackup, restoredDocs };
}
