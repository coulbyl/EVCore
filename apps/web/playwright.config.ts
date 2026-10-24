import { defineConfig, devices } from "@playwright/test";

// Overridable so a dev whose 3000 is taken can still run the suite
// (`E2E_WEB_PORT=3010 E2E_MOCK_PORT=3109 pnpm exec playwright test`).
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3000);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3099);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,

  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],

  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Le produit est français d'abord et la langue suit Accept-Language
    // (proxy.ts) : sans cela les tests tournaient en anglais et ne
    // vérifiaient le français que là où il était écrit en dur.
    locale: "fr-FR",
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
      name: "recording-desktop-1280",
      use: {
        viewport: { width: 1280, height: 720 },
        storageState: "playwright/.auth/user.json",
        video: { mode: "on", size: { width: 1280, height: 720 } },
      },
      dependencies: ["setup"],
      testMatch: /formation-intro-video\.spec\.ts/,
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

  // Côté Node (sondes de disponibilité, appels serveur de Next vers le faux
  // backend), toujours 127.0.0.1 : sur certains postes `localhost` résout
  // d'abord en ::1 et chaque requête attend seize secondes avant de retomber
  // en IPv4 — la sonde de 10 s expirait sans jamais voir le serveur prêt.
  // Le navigateur, lui, garde `localhost` (domaine du cookie de session).
  webServer: [
    {
      command: "node e2e/support/mock-backend.mjs",
      url: `http://127.0.0.1:${MOCK_PORT}/health`,
      env: { E2E_MOCK_PORT: String(MOCK_PORT) },
      reuseExistingServer: !process.env.CI,
      timeout: 10_000,
    },
    {
      command: `pnpm dev --port ${WEB_PORT}`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_API_URL: `http://127.0.0.1:${MOCK_PORT}`,
        E2E_MOCK_PORT: String(MOCK_PORT),
      },
    },
  ],
});
