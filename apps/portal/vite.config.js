import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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
  server: { port: 5174, https: getHttpsConfig() },
  build: { outDir: 'dist', sourcemap: true },
});
