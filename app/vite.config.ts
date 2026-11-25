/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Plant-local time for deterministic tests (Azerbaijan, UTC+4, no DST).
process.env.TZ = 'Asia/Baku';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  preview: { host: '127.0.0.1', port: 5174 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Function form: the object form also pulls shared deps (clsx, ...) into
        // "charts", which made the entry chunk import and preload all of recharts.
        manualChunks(id: string) {
          if (!id.includes('/node_modules/')) return undefined;
          if (/\/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom|@remix-run|clsx|use-sync-external-store)\//.test(id))
            return 'react';
          if (
            /\/node_modules\/(recharts|victory-vendor|d3-[^/]+|internmap|@reduxjs|redux|react-redux|redux-thunk|reselect|immer|decimal\.js-light|es-toolkit|eventemitter3|tiny-invariant)\//.test(
              id,
            )
          )
            return 'charts';
          if (/\/node_modules\/(@radix-ui|@floating-ui|react-remove-scroll|react-remove-scroll-bar|react-style-singleton|use-callback-ref|use-sidecar|aria-hidden|get-nonce|detect-node-es)\//.test(id))
            return 'radix';
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    testTimeout: 20000,
    // Node ≥ 25 ships a native localStorage that warns without a backing file; jsdom provides one.
    execArgv:
      Number(process.versions.node.split('.')[0]) >= 25 ? ['--no-experimental-webstorage'] : [],
    coverage: {
      provider: 'v8',
      include: ['src/domain/**/*.ts', 'src/lib/format.ts', 'src/data/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        '**/types.ts',
        'src/data/sources/EnergyDataSource.ts',
        'src/data/sources/analysis.worker.ts',
      ],
      reporter: ['text-summary', 'text'],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 70 },
    },
  },
});
