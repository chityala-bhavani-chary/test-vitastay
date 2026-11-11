
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  server: {
    port: 3001,
    host: '0.0.0.0',
    strictPort: true,

    allowedHosts: [
      'test.vitastay.in',
      '.trycloudflare.com',
    ],

    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        xfwd: true,
        secure: false,

        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            console.error('API Proxy Error:', err.message);

            if (
              !res ||
              res.headersSent ||
              typeof res.writeHead !== 'function'
            ) return;

            res.writeHead(503, {
              'Content-Type': 'application/json',
            });

            res.end(JSON.stringify({
              success: false,
              message: 'The API is restarting. Retry in a moment.',
            }));
          });
        },
      },

      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        xfwd: true,
        secure: false,
      },
    },
  },

  build: {
    outDir: 'dist',
    sourcemap: false,

    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          mui: ['@mui/material', '@mui/icons-material'],
          charts: ['chart.js', 'react-chartjs-2'],
        },
      },
    },
  },
});
