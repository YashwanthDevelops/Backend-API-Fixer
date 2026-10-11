import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: '.tracefix-runtime/vite',
  test: { include: ['test/**/*.test.ts'], fileParallelism: false },
});
