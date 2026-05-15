import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    // Allow access from any *.localhost subdomain for multi-tenancy
    // (e.g. acme.localhost:5173 → tenant 'acme', localhost:5173 → host).
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://localhost:44324',
        changeOrigin: true,
        secure: false,
      },
      '/connect': {
        target: 'https://localhost:44324',
        changeOrigin: true,
        secure: false,
      },
      '/signalr-hubs': {
        target: 'https://localhost:44324',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
