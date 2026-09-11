import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
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

            // Split the Firebase SDK by functional surface instead of forcing the
            // full client stack into one >500 KiB minified vendor chunk. Shared
            // Firebase internals remain in a stable core cache boundary.
            if (id.includes('/@firebase/auth/')) return 'vendor-firebase-auth';
            if (id.includes('/@firebase/firestore/')) return 'vendor-firebase-firestore';
            if (id.includes('/@firebase/messaging/')) return 'vendor-firebase-messaging';
            if (id.includes('/@firebase/storage/')) return 'vendor-firebase-storage';
            if (id.includes('/firebase/') || id.includes('/@firebase/')) {
              return 'vendor-firebase-core';
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
  };
});
