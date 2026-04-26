import { nextJsConfig } from "@evcore/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...nextJsConfig,
  { ignores: ["e2e/**", "playwright.config.ts"] },
];
