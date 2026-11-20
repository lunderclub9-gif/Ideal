import AdmZip from 'adm-zip';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { BACKUPS_DIR, closeDb, DATA_DIR, DB_PATH, DOCS_DIR, ensureDirectories, getDb, reopenDb } from './db.ts';
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

type BackupManifest = {
  app: string;
  schema_version: number;
  backup_type: string;
  created_at: string;
  created_by: string;
  db_sha256: string;
  document_count: number;
  integrity_check: string;
  files?: Array<{ path: string; size: number; sha256: string }>;
};

function sha256Buffer(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function collectFilesRecursive(dir: string, baseDir: string): Array<{ relPath: string; absPath: string }> {
  const results: Array<{ relPath: string; absPath: string }> = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absPath = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursive(absPath, baseDir));
    } else if (entry.isFile()) {
      results.push({ relPath: path.relative(baseDir, absPath).split(path.sep).join('/'), absPath });
    }
  }
  return results;
}

function verifySqliteSnapshot(snapshotPath: string) {
  const testDb = new Database(snapshotPath, { readonly: true, fileMustExist: true });
  try {
    const row = testDb.prepare('PRAGMA integrity_check').get() as { integrity_check?: string } | undefined;
    if (!row || row.integrity_check !== 'ok') {
      throw new Error(`Vérification d’intégrité SQLite échouée : ${row?.integrity_check || 'inconnue'}`);
    }
    const foreignKeyIssue = testDb.prepare('PRAGMA foreign_key_check').get();
    if (foreignKeyIssue) throw new Error('La base restaurée contient des références internes incohérentes.');
    const tables = testDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    if (!tables.some((table) => table.name === 'users') || !tables.some((table) => table.name === 'company_settings')) {
      throw new Error('La base ne contient pas les tables essentielles de IDEAL.');
    }
  } finally {
    testDb.close();
  }
}

function currentSchemaVersion(db: Database.Database): number {
  try {
    const row = db.prepare('SELECT COALESCE(MAX(version), 1) AS version FROM schema_migrations').get() as { version: number };
    return Number(row.version || 1);
  } catch {
    return 1;
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
    '-', process.pid, '-', crypto.randomBytes(3).toString('hex'),
  ].join('');

  const tempSnapshot = path.join(BACKUPS_DIR, `.snapshot-${stamp}.db`);
  const fileName = `gestionpro-dz-${stamp}-${backupType}.zip`;
  const filePath = path.join(BACKUPS_DIR, fileName);
  const tempZipPath = `${filePath}.tmp`;

  try {
    // VACUUM INTO creates a consistent SQLite snapshot, including committed WAL data.
    const escapedSnapshot = tempSnapshot.replace(/'/g, "''");
    db.exec(`VACUUM INTO '${escapedSnapshot}'`);
    verifySqliteSnapshot(tempSnapshot);

    const dbBytes = fs.readFileSync(tempSnapshot);
    const docFiles = collectFilesRecursive(DOCS_DIR, DOCS_DIR);
    const zip = new AdmZip();
    zip.addFile('gestionpro.db', dbBytes);

    const manifestFiles: NonNullable<BackupManifest['files']> = [];
    for (const doc of docFiles) {
      const bytes = fs.readFileSync(doc.absPath);
      zip.addFile(`Documents/${doc.relPath}`, bytes);
      manifestFiles.push({ path: doc.relPath, size: bytes.length, sha256: sha256Buffer(bytes) });
    }

    const manifest: BackupManifest = {
      app: 'IDEAL',
      schema_version: currentSchemaVersion(db),
      backup_type: backupType,
      created_at: now.toISOString(),
      created_by: createdBy,
      db_sha256: sha256Buffer(dbBytes),
      document_count: docFiles.length,
      integrity_check: 'ok',
      files: manifestFiles,
    };
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
    zip.writeZip(tempZipPath);

    // Verify the completed archive before making it visible in backup history.
    const checkZip = new AdmZip(tempZipPath);
    const checkDb = checkZip.getEntry('gestionpro.db');
    const checkManifest = checkZip.getEntry('manifest.json');
    if (!checkDb || !checkManifest || sha256Buffer(checkDb.getData()) !== manifest.db_sha256) {
      throw new Error('La vérification finale de l’archive ZIP a échoué.');
    }
    const parsed = JSON.parse(checkManifest.getData().toString('utf8')) as BackupManifest;
    if (parsed.document_count !== docFiles.length || parsed.integrity_check !== 'ok') {
      throw new Error('Le manifeste de sauvegarde est incomplet ou invalide.');
    }

    fs.renameSync(tempZipPath, filePath);
    const sizeBytes = fs.statSync(filePath).size;
    const info = db.prepare(
      `INSERT INTO backup_history (file_name, file_path, backup_type, size_bytes, verified, created_by)
       VALUES (?, ?, ?, ?, 1, ?)`
    ).run(fileName, filePath, backupType, sizeBytes, createdBy);

    if (backupType === 'auto_daily') pruneOldDailyBackups();
    return db.prepare('SELECT * FROM backup_history WHERE id = ?').get(info.lastInsertRowid) as BackupEntry;
  } catch (error) {
    for (const temporary of [tempSnapshot, tempZipPath]) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    }
    throw error;
  }
}

export function pruneOldDailyBackups() {
  const db = getDb();
  const settings = db.prepare('SELECT auto_backup_keep_daily FROM company_settings WHERE id = 1').get() as
    | { auto_backup_keep_daily?: number }
    | undefined;
  const keepCount = Math.max(1, Math.min(365, Number(settings?.auto_backup_keep_daily ?? 30)));
  const dailies = db
    .prepare("SELECT id, file_path FROM backup_history WHERE backup_type = 'auto_daily' ORDER BY id DESC")
    .all() as Array<{ id: number; file_path: string }>;

  if (dailies.length <= keepCount) return;
  for (const old of dailies.slice(keepCount)) {
    try { if (fs.existsSync(old.file_path)) fs.unlinkSync(old.file_path); } catch {}
    db.prepare('DELETE FROM backup_history WHERE id = ?').run(old.id);
  }
}

export function listBackups(): BackupEntry[] {
  const db = getDb();
  return db.prepare('SELECT * FROM backup_history ORDER BY id DESC LIMIT 100').all() as BackupEntry[];
}

export function verifyBackupArchive(filePath: string): { verified: true; documentCount: number; schemaVersion: number } {
  if (!fs.existsSync(filePath)) throw new Error('Archive de sauvegarde introuvable sur le disque.');
  const zip = new AdmZip(filePath);
  const dbEntry = zip.getEntry('gestionpro.db');
  const manifestEntry = zip.getEntry('manifest.json');
  if (!dbEntry || !manifestEntry) throw new Error('Archive invalide : base ou manifeste manquant.');
  const dbBytes = dbEntry.getData();
  const manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as BackupManifest;
  if (!manifest.db_sha256 || sha256Buffer(dbBytes) !== manifest.db_sha256) {
    throw new Error('Empreinte SHA-256 de la base incorrecte.');
  }
  if (manifest.integrity_check !== 'ok') throw new Error('Le manifeste ne confirme pas l’intégrité de la base.');
  const tempPath = path.join(BACKUPS_DIR, `.verify-${Date.now()}-${process.pid}.db`);
  try {
    fs.writeFileSync(tempPath, dbBytes, { flag: 'wx' });
    verifySqliteSnapshot(tempPath);
  } finally {
    try { if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath); } catch {}
  }

  const expected = new Map((manifest.files || []).map((file) => [safeArchivePath(file.path), file]));
  let documentCount = 0;
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory || entry.entryName === 'gestionpro.db' || entry.entryName === 'manifest.json') continue;
    const normalized = entry.entryName.replace(/\\/g, '/');
    if (!normalized.startsWith('Documents/')) throw new Error('L’archive contient un fichier hors de Documents.');
    const relative = safeArchivePath(normalized.slice('Documents/'.length));
    const bytes = entry.getData();
    const declared = expected.get(relative);
    if (manifest.files && !declared) throw new Error(`Le document ${relative} ne figure pas dans le manifeste.`);
    if (declared && (declared.size !== bytes.length || declared.sha256 !== sha256Buffer(bytes))) {
      throw new Error(`Intégrité du document ${relative} incorrecte.`);
    }
    documentCount++;
  }
  if (manifest.document_count !== documentCount || (manifest.files && expected.size !== documentCount)) {
    throw new Error('Le nombre de documents ne correspond pas au manifeste.');
  }
  return { verified: true, documentCount, schemaVersion: Number(manifest.schema_version || 1) };
}

function safeArchivePath(relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, '/');
  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new Error('L’archive contient un chemin de fichier non autorisé.');
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('L’archive contient un chemin de fichier non autorisé.');
  }
  return normalized;
}

export function restoreFromZip(
  zipBuffer: Buffer,
  restoredBy: string
): { safetyBackup: BackupEntry; restoredDocs: number } {
  ensureDirectories();
  if (!zipBuffer?.length || zipBuffer.length > 50 * 1024 * 1024) {
    throw new Error('L’archive doit être valide et ne pas dépasser 50 Mo.');
  }

  const zip = new AdmZip(zipBuffer);
  const entries = zip.getEntries();
  if (entries.length > 5000) throw new Error('L’archive contient trop de fichiers.');
  const dbEntry = zip.getEntry('gestionpro.db');
  if (!dbEntry || dbEntry.isDirectory) throw new Error('Archive invalide : le fichier gestionpro.db est introuvable dans le ZIP.');

  const dbBuf = dbEntry.getData();
  if (!dbBuf.length || dbBuf.length > 1024 * 1024 * 1024) throw new Error('La taille de la base de données dans l’archive est invalide.');
  const manifestEntry = zip.getEntry('manifest.json');
  let manifest: BackupManifest | null = null;
  if (manifestEntry) {
    try {
      manifest = JSON.parse(manifestEntry.getData().toString('utf8')) as BackupManifest;
      if (manifest.db_sha256 && sha256Buffer(dbBuf) !== manifest.db_sha256) {
        throw new Error('L’empreinte SHA-256 de la base de données ne correspond pas au manifeste.');
      }
      if (manifest.integrity_check && manifest.integrity_check !== 'ok') throw new Error('Le manifeste indique une sauvegarde non vérifiée.');
      if (manifest.schema_version && manifest.schema_version > currentSchemaVersion(getDb())) {
        throw new Error('Cette sauvegarde provient d’une version plus récente de IDEAL. Mettez le programme à jour avant de la restaurer.');
      }
    } catch (err: any) {
      if (/SHA-256|plus récente|non vérifiée/.test(String(err.message || ''))) throw err;
      throw new Error('Le manifeste manifest.json est corrompu ou illisible.');
    }
  }

  const tempId = `${Date.now()}-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  const tempCheck = path.join(BACKUPS_DIR, `.restore-check-${tempId}.db`);
  const stagedDb = path.join(BACKUPS_DIR, `.restore-staged-${tempId}.db`);
  const stagedDocs = path.join(DATA_DIR, `.restore-documents-${tempId}`);
  const rollbackDb = path.join(BACKUPS_DIR, `.rollback-${tempId}.db`);
  const rollbackDocs = path.join(DATA_DIR, `.rollback-documents-${tempId}`);

  let restoredDocs = 0;
  let totalUncompressed = dbBuf.length;
  try {
    fs.writeFileSync(tempCheck, dbBuf, { flag: 'wx' });
    verifySqliteSnapshot(tempCheck);
    fs.writeFileSync(stagedDb, dbBuf, { flag: 'wx' });
    fs.mkdirSync(stagedDocs, { recursive: false });

    const expectedFiles = new Map((manifest?.files || []).map((file) => [safeArchivePath(file.path), file]));
    for (const entry of entries) {
      if (entry.isDirectory || entry.entryName === 'gestionpro.db' || entry.entryName === 'manifest.json') continue;
      const normalizedEntry = entry.entryName.replace(/\\/g, '/');
      if (!normalizedEntry.startsWith('Documents/')) {
        throw new Error('L’archive contient un élément inattendu hors du dossier Documents.');
      }
      const rel = safeArchivePath(normalizedEntry.slice('Documents/'.length));
      const declared = expectedFiles.get(rel);
      const size = Number(entry.header?.size || 0);
      totalUncompressed += size;
      if (size > 100 * 1024 * 1024 || totalUncompressed > 500 * 1024 * 1024) {
        throw new Error('L’archive dépasse la limite de taille autorisée après décompression.');
      }
      const target = path.resolve(stagedDocs, ...rel.split('/'));
      if (!target.startsWith(stagedDocs + path.sep)) throw new Error('Chemin de fichier non autorisé dans l’archive.');
      const bytes = entry.getData();
      if (bytes.length !== size) throw new Error('Un fichier de l’archive est incomplet.');
      if (manifest?.files && !declared) throw new Error(`Le document ${rel} ne figure pas dans le manifeste.`);
      if (declared && (declared.size !== bytes.length || declared.sha256 !== sha256Buffer(bytes))) {
        throw new Error(`La vérification du fichier ${rel} a échoué.`);
      }
      if (fs.existsSync(target)) throw new Error('L’archive contient des chemins de fichiers en double.');
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, bytes, { flag: 'wx' });
      restoredDocs++;
    }
    if (manifest && manifest.document_count !== restoredDocs) {
      throw new Error('Le nombre de documents ne correspond pas au manifeste de sauvegarde.');
    }
    if (manifest?.files && expectedFiles.size !== restoredDocs) {
      throw new Error('La liste des fichiers du manifeste ne correspond pas à l’archive.');
    }
  } catch (error) {
    for (const temporary of [tempCheck, stagedDb]) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    }
    try { if (fs.existsSync(stagedDocs)) fs.rmSync(stagedDocs, { recursive: true, force: true }); } catch {}
    throw error;
  } finally {
    try { if (fs.existsSync(tempCheck)) fs.unlinkSync(tempCheck); } catch {}
  }

  // Keep a verified copy of the current database and documents before any live swap.
  let safetyBackup: BackupEntry;
  try {
    safetyBackup = createFullBackup('pre_restore_safety', restoredBy);
  } catch (error) {
    for (const temporary of [tempCheck, stagedDb]) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    }
    try { if (fs.existsSync(stagedDocs)) fs.rmSync(stagedDocs, { recursive: true, force: true }); } catch {}
    throw error;
  }
  let oldDbMoved = false;
  let oldDocsMoved = false;
  let newDbInstalled = false;
  let newDocsInstalled = false;

  try {
    closeDb();
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = `${DB_PATH}${suffix}`;
      if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
    }
    if (fs.existsSync(DB_PATH)) {
      fs.renameSync(DB_PATH, rollbackDb);
      oldDbMoved = true;
    }
    fs.renameSync(stagedDb, DB_PATH);
    newDbInstalled = true;

    if (fs.existsSync(DOCS_DIR)) {
      fs.renameSync(DOCS_DIR, rollbackDocs);
      oldDocsMoved = true;
    }
    fs.renameSync(stagedDocs, DOCS_DIR);
    newDocsInstalled = true;

    const db = reopenDb();
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

    // The restored database and document tree are live. Cleanup failures must not
    // trigger a rollback after the new database has already been accepted.
    try { if (oldDbMoved && fs.existsSync(rollbackDb)) fs.unlinkSync(rollbackDb); } catch {}
    try { if (oldDocsMoved && fs.existsSync(rollbackDocs)) fs.rmSync(rollbackDocs, { recursive: true, force: true }); } catch {}
    return { safetyBackup, restoredDocs };
  } catch (error) {
    try { closeDb(); } catch {}
    try {
      if (newDbInstalled && fs.existsSync(DB_PATH)) fs.unlinkSync(DB_PATH);
      if (oldDbMoved && fs.existsSync(rollbackDb)) fs.renameSync(rollbackDb, DB_PATH);
      if (newDocsInstalled && fs.existsSync(DOCS_DIR)) fs.rmSync(DOCS_DIR, { recursive: true, force: true });
      if (oldDocsMoved && fs.existsSync(rollbackDocs)) fs.renameSync(rollbackDocs, DOCS_DIR);
      for (const suffix of ['-wal', '-shm']) {
        const sidecar = `${DB_PATH}${suffix}`;
        if (fs.existsSync(sidecar)) fs.unlinkSync(sidecar);
      }
      reopenDb();
    } catch (rollbackError) {
      throw new Error(`La restauration a échoué et la remise en place automatique doit être vérifiée manuellement : ${String(rollbackError)}`);
    }
    throw error;
  } finally {
    for (const temporary of [tempCheck, stagedDb]) {
      try { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); } catch {}
    }
    try { if (fs.existsSync(stagedDocs)) fs.rmSync(stagedDocs, { recursive: true, force: true }); } catch {}
  }
}
