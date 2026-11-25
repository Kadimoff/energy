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
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-tooltip',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
          ],
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
