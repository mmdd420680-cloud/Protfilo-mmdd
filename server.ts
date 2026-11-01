import path from 'path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { env } from './server/src/config/env';
import { connectDatabase } from './server/src/config/database';
import { ensureSeededDatabase } from './server/src/services/seedService';
import { createExpressApp } from './server/src/app';
import { errorHandler } from './server/src/middleware/errorHandler';

async function startFullStackServer() {
  await connectDatabase();
  await ensureSeededDatabase(false);

  const app = createExpressApp();

  if (!env.IS_PROD) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath, { maxAge: '7d' }));
    app.get('*', (req, res) => {
      if (req.path.startsWith('/src/') || req.path.startsWith('/uploads/')) {
        res.status(404).json({
          success: false,
          error: { code: 'ASSET_NOT_FOUND', message: 'Static asset not found.' },
        });
        return;
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  const port = env.PORT || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Mahim Dev Portfolio & CMS listening on http://0.0.0.0:${port} (${env.NODE_ENV})`);
  });
}

startFullStackServer().catch((err) => {
  console.error('[Fatal] Failed to launch full-stack server:', err);
  process.exit(1);
});
