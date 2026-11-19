import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { getDb } from './server/db.ts';
import { seedIfEmpty } from './server/seed.ts';
import apiRouter from './server/routes.ts';
import { createFullBackup } from './server/backup.ts';

async function startServer() {
  getDb();
  seedIfEmpty();

  const app = express();
  app.use(express.json({ limit: '15mb' }));

  app.use('/api', apiRouter);

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status || 500;
    const message = err?.message || 'Une erreur interne est survenue lors du traitement de votre demande.';
    res.status(status).json({ error: message });
  });

  if (process.env.NODE_ENV === 'production') {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`GestionPro DZ prêt sur http://localhost:${PORT}`);
  });

  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const hasToday = db
      .prepare("SELECT id FROM backup_history WHERE backup_type = 'auto_daily' AND substr(created_at, 1, 10) = ? LIMIT 1")
      .get(today);
    if (!hasToday) {
      createFullBackup('auto_daily', 'Sauvegarde automatique quotidienne');
    }
  } catch {
    // Non-fatal on startup
  }
}

startServer();
