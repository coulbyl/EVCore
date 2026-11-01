import { expect, test, type BrowserContext } from "@playwright/test";

/**
 * La bascule (15-todo.md C19, 11 § 8) : un joueur qui ouvre une ancienne
 * adresse de /dashboard arrive sur l'écran qui la remplace ; l'admin aussi,
 * /dashboard n'existe plus (12-admin § 0).
 */
async function asPlayer(context: BrowserContext) {
  await context.addCookies([
    { name: "evcore_session", value: "player", domain: "localhost", path: "/" },
  ]);
}

test.describe("Bascule vers les quatre onglets", () => {
  for (const [from, to] of [
    ["/dashboard", "/today"],
    ["/dashboard/coupons", "/today"],
    ["/dashboard/decisions", "/matches"],
    ["/dashboard/track-record", "/results"],
    ["/dashboard/bet-slips", "/me"],
    ["/dashboard/inbox", "/me/messages"],
    ["/dashboard/formation", "/me/help"],
    ["/dashboard/params/account", "/me/account"],
    ["/dashboard/notifications", "/notifications"],
  ] as const) {
    test(`un joueur sur ${from} arrive sur ${to}`, async ({
      page,
      context,
    }) => {
      await asPlayer(context);
      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`${to.replace("/", "\\/")}$`));
    });
  }

  for (const [from, to] of [
    ["/dashboard", "/admin"],
    ["/dashboard/audit", "/admin/engine"],
    ["/dashboard/users", "/admin/players"],
    ["/dashboard/coupons", "/today"],
  ] as const) {
    test(`l'admin sur ${from} arrive sur ${to}`, async ({ page }) => {
      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`${to.replace("/", "\\/")}$`));
    });
  }

  test("l'ancienne boîte de support mène aux Messages de l'admin", async ({
    page,
  }) => {
    await page.goto("/dashboard/inbox/42");
    await expect(page).toHaveURL(/\/admin\/messages\/42$/);
  });

  test("le ticket demande une session, comme les onglets", async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/ticket");
    await expect(page).toHaveURL(/\/auth\/login/);
    await context.close();
  });
});
