import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup.ts'],
  },
  plugins: [
    // Required for NestJS decorator metadata (emitDecoratorMetadata) in tests
    swc.vite({ module: { type: 'es6' } }),
  ],
});
