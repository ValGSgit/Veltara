import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const proxyTarget = process.env.WORKERS_PROXY_TARGET ?? 'https://localhost:8787';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getHttpsConfig() {
  if (String(process.env.DEV_HTTPS ?? '').toLowerCase() === 'false') {
    return false;
  }

  const certPath = process.env.DEV_HTTPS_CERT
    ?? path.resolve(__dirname, '../../certs/localhost.pem');
  const keyPath = process.env.DEV_HTTPS_KEY
    ?? path.resolve(__dirname, '../../certs/localhost-key.pem');

  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    return {
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }

  return true;
}

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    https: getHttpsConfig(),
    proxy: {
      '/api': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
        secure: false,
      },
      '/v1': {
        target: proxyTarget,
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  assetsInclude: ['**/*.glsl'],
});
