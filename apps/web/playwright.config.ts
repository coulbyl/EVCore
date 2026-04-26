import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 3000;
const MOCK_PORT = 3099;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [["html", { outputFolder: "playwright-report", open: "never" }], ["list"]],

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "mobile-375",
      use: {
        viewport: { width: 375, height: 667 },
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "tablet-768",
      use: {
        viewport: { width: 768, height: 1024 },
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
    {
      name: "desktop-1280",
      use: {
        viewport: { width: 1280, height: 800 },
        storageState: "playwright/.auth/user.json",
      },
      dependencies: ["setup"],
      testIgnore: /auth\.setup\.ts/,
    },
  ],

  webServer: [
    {
      command: "node e2e/support/mock-backend.mjs",
      url: `http://localhost:${MOCK_PORT}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      command: "pnpm dev",
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://localhost:${MOCK_PORT}`,
      },
    },
  ],
});
