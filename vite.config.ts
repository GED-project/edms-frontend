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
