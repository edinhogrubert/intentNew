import 'dotenv/config';
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { resolveDatabaseUrl } from './backend/src/lib/db-url.js';

// Garantir que DATABASE_URL esteja definida e higienizada no process.env para o Prisma e o backend
resolveDatabaseUrl();

import { createApp } from './backend/src/app.js';

const PORT = 3000;

async function startServer() {
  const app = express();

  app.disable('x-powered-by');

  const isDev = process.env.NODE_ENV !== 'production';

  // Proteções de segurança e políticas HTTP para o Frontend (HTML / assets)
  app.use(helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    // Desativa o X-Frame-Options legado em favor da diretiva estrita frame-ancestors no CSP abaixo
    frameguard: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Em desenvolvimento: permite unsafe-eval e unsafe-inline para o Vite HMR.
        // Em produção: estritamente scripts empacotados da própria aplicação ('self'), sem eval, inline ou domínios externos desnecessários.
        scriptSrc: isDev
          ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
          : ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'https:', 'blob:'],
        connectSrc: [
          "'self'",
          'https://*.googleapis.com',
          'https://*.firebaseio.com',
          'https://identitytoolkit.googleapis.com',
          'https://securetoken.googleapis.com',
          ...(isDev ? ['ws://localhost:3000', 'wss://localhost:3000'] : []),
        ],
        frameSrc: ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com'],
        // Permite incorporação estritamente na própria origem e nos hosts oficiais de preview do AI Studio
        frameAncestors: ["'self'", 'https://ai.studio', 'https://aistudio.google.com'],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }));

  // Rotas da API oficial (/api/v1/...)
  const apiApp = createApp();
  app.use('/api', apiApp);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Intent] Servidor Full-Stack rodando na porta ${PORT}`);
  });
}

startServer();
