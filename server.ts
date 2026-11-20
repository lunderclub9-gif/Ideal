import express from 'express';
import path from 'path';
import { getDb } from './server/db.ts';
import apiRouter from './server/routes.ts';
import { createFullBackup } from './server/backup.ts';

async function startServer() {
  getDb();
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', apiRouter);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status || 500;
    const message = err?.message || 'Une erreur interne est survenue lors du traitement de votre demande.';
    res.status(status).json({ error: message });
  });
  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.env.GESTIONPRO_APP_ROOT || process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const PORT = Number(process.env.PORT || 3000);
  const HOST = process.env.HOST || '127.0.0.1';
  const httpServer = app.listen(PORT, HOST, () => {
    const address = httpServer.address();
    const actualPort = typeof address === 'object' && address ? address.port : PORT;
    console.log(`IDEAL_SERVER_READY:${actualPort}`);
    console.log(`IDEAL prêt sur http://127.0.0.1:${actualPort}`);
  });
  httpServer.on('error', (error) => {
    console.error('IDEAL_SERVER_ERROR', error);
    process.exitCode = 1;
  });
  const localDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const runDailyBackupIfDue = () => {
    try {
      const db = getDb();
      const settings = db.prepare('SELECT auto_backup_time FROM company_settings WHERE id = 1').get() as { auto_backup_time?: string } | undefined;
      const configuredTime = /^([01]\\d|2[0-3]):([0-5]\\d)$/.test(String(settings?.auto_backup_time || ''))
        ? String(settings?.auto_backup_time)
        : '19:00';
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const today = localDate();
      const hasToday = db.prepare(
        "SELECT id FROM backup_history WHERE backup_type = 'auto_daily' AND date(created_at, 'localtime') = ? LIMIT 1"
      ).get(today);
      if (!hasToday && currentTime >= configuredTime) {
        createFullBackup('auto_daily', 'Sauvegarde automatique quotidienne');
      }
    } catch (error) {
      console.error('IDEAL_BACKUP_ERROR', error);
    }
  };

  // Apply the configured local time immediately, then check once per minute.
  runDailyBackupIfDue();
  const backupTimer = setInterval(runDailyBackupIfDue, 60_000);
  backupTimer.unref();
}
startServer().catch((error) => {
  console.error('IDEAL_STARTUP_ERROR', error);
  process.exit(1);
});
