import { nestJsConfig } from '@evcore/eslint-config/nest-js';

export default nestJsConfig({
  tsconfigRootDir: import.meta.dirname,
});
