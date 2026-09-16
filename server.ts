import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { resolveDatabaseUrl } from './backend/src/lib/db-url.js';

// Garantir que DATABASE_URL esteja definida e higienizada no process.env para o Prisma e o backend
resolveDatabaseUrl();


import { createApp } from './backend/src/app.js';

const PORT = 3000;

async function startServer() {
  const server = express();

  // Rotas da API oficial (/api/v1/...)
  const apiApp = createApp();
  server.use('/api', apiApp);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, host: '0.0.0.0', port: PORT },
      appType: 'spa',
    });
    server.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    server.use(express.static(distPath));
    server.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Intent] Servidor Full-Stack rodando na porta ${PORT}`);
  });
}

startServer();
