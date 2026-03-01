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
    dir: './test',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup.ts'],
    globalSetup: ['./test/setup/global-e2e.ts'],
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
