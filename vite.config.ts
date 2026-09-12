import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    server: { proxy: { "/api": { target: "http://localhost:8080", changeOrigin: true, secure: false } } },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/@firebase/auth')) return 'firebase-auth';
            if (id.includes('node_modules/@firebase/app')) return 'firebase-app';
            if (id.includes('node_modules/firebase')) return 'firebase-core';
            if (id.includes('node_modules/react')) return 'react';
            if (id.includes('node_modules/lucide-react')) return 'icons';
            if (id.includes('/src/components/')) {
              const name = id.split('/src/components/')[1].split('/')[0].split('.')[0];
              return `component-${name.toLowerCase()}`;
            }
            return undefined;
          },
          chunkFileNames: 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
