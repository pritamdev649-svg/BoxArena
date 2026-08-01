import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    /**
     * Tests must not depend on the machine's timezone. India has no DST, so a
     * TZ bug here would pass locally and fail in a UTC container.
     */
    env: { TZ: 'UTC' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/mocks/**', 'src/app/**'],
    },
  },
  resolve: {
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
});
