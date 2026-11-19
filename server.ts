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
    console.log(`GESTIONPRO_SERVER_READY:${actualPort}`);
    console.log(`GestionPro DZ prêt sur http://127.0.0.1:${actualPort}`);
  });
  httpServer.on('error', (error) => {
    console.error('GESTIONPRO_SERVER_ERROR', error);
    process.exitCode = 1;
  });
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const hasToday = db.prepare("SELECT id FROM backup_history WHERE backup_type = 'auto_daily' AND substr(created_at, 1, 10) = ? LIMIT 1").get(today);
    if (!hasToday) createFullBackup('auto_daily', 'Sauvegarde automatique quotidienne');
  } catch {
    // Non-fatal on startup
  }
}
startServer().catch((error) => {
  console.error('GESTIONPRO_STARTUP_ERROR', error);
  process.exit(1);
});
