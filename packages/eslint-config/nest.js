import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Shared ESLint config for NestJS services.
 *
 * @param {{ tsconfigRootDir?: string, ignores?: string[] }} [options]
 * @returns {import("eslint").Linter.Config[]}
 */
export function nestJsConfig(options = {}) {
  const {
    tsconfigRootDir = process.cwd(),
    ignores = ["eslint.config.mjs"],
  } = options;

  return defineConfig(
    {
      ignores,
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    eslintPluginPrettierRecommended,
    {
      languageOptions: {
        globals: {
          ...globals.node,
          ...globals.vitest,
        },
        sourceType: "commonjs",
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
    },
    {
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-floating-promises": "warn",
        "@typescript-eslint/no-unsafe-argument": "warn",
        "prettier/prettier": ["error", { endOfLine: "auto" }],
      },
    },
  );
}
