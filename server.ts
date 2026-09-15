import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

// Garantir que DATABASE_URL esteja definida no process.env para o Prisma e o backend
function setupEnvironment() {
  if (!process.env.DATABASE_URL) {
    const user = process.env.SQL_USER || process.env.SQL_ADMIN_USER;
    const password = process.env.SQL_PASSWORD || process.env.SQL_ADMIN_PASSWORD;
    const dbName = process.env.SQL_DB_NAME || 'cloud_sql_development_database';
    const host = process.env.SQL_HOST;

    if (user && password && host) {
      if (host.startsWith('/')) {
        process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost/${dbName}?host=${encodeURIComponent(host)}`;
      } else {
        process.env.DATABASE_URL = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${dbName}`;
      }
    }
  }
}
setupEnvironment();

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
