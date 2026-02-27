import { nestJsConfig } from '@evcore/eslint-config/nest-js';

export default [
  ...nestJsConfig({
    tsconfigRootDir: import.meta.dirname,
  }),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
];
