import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const srcDir = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': srcDir,
      '@config': `${srcDir}/config`,
      '@modules': `${srcDir}/modules`,
      '@utils': `${srcDir}/utils`,
    },
  },
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
