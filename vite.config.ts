import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => ({
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
          if (!id.includes('node_modules')) return undefined;

          // Keep Firebase SDKs out of the application shell. These modules are
          // shared across authentication, Firestore and notification flows and
          // benefit from a stable browser-cache boundary.
          if (id.includes('/firebase/') || id.includes('/@firebase/')) {
            return 'vendor-firebase';
          }

          // Recharts pulls in d3 helpers; isolate the visualization stack so
          // members who never open chart-heavy workflows do not pay for it in
          // the initial application chunk.
          if (id.includes('/recharts/') || id.includes('/d3-')) {
            return 'vendor-charts';
          }

          // Motion is UI-enhancement code and can be cached independently from
          // the core React/router shell.
          if (id.includes('/motion/') || id.includes('/framer-motion/')) {
            return 'vendor-motion';
          }

          return undefined;
        },
      },
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modify—file watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
}));
