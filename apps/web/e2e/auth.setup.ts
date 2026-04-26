import { test as setup } from "@playwright/test";

const AUTH_FILE = "playwright/.auth/user.json";

/**
 * Injects a fake session cookie for localhost so Next.js server-side requests
 * forward it to the mock backend, which always returns a valid session.
 * No real HTTP login needed — avoids cross-origin cookie issues.
 */
setup("inject test session cookie", async ({ context }) => {
  await context.addCookies([
    {
      name: "evcore_session",
      value: "e2e-session",
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax",
    },
  ]);

  await context.storageState({ path: AUTH_FILE });
});
