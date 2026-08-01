import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    /** Spinning up a replica set is slow; give hooks real headroom. */
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { TZ: 'UTC' },
    /** One fork: the in-memory replica set is shared process-wide. */
    pool: 'forks',
    isolate: false,
    fileParallelism: false,
  },
  resolve: {
    alias: { '@': new URL('./src/', import.meta.url).pathname },
  },
});
