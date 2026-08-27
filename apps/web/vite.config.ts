import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { screenCastVersionPlugin } from './vite/screen-cast-version-plugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), screenCastVersionPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@mali-one/shared': path.resolve(
        __dirname,
        '../../packages/shared/src/index.ts',
      ),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 900_000,
        proxyTimeout: 900_000,
      },
      '/r': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
