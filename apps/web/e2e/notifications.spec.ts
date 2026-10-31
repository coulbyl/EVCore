import { expect, test } from "@playwright/test";

/**
 * La cloche (09 § 6, maquette Cloche) : le compte des non-lues sur la
 * cloche, une liste sans onglet ; ouvrir ne marque rien, toucher une ligne
 * la marque lue et mène où elle parle.
 */
test.describe("Notifications", () => {
  test("la cloche porte le compte des non-lues", async ({ page }) => {
    await page.goto("/today");
    await expect(
      page.getByRole("link", { name: /^Notifications, \d+ non lues$/ }).first(),
    ).toBeVisible();
  });

  test("la liste : les plus récentes d'abord, sans onglet ; ouvrir ne marque rien", async ({
    page,
  }) => {
    let reads = 0;
    page.on("request", (r) => {
      if (/\/notifications\/[^/]+\/read$/.test(r.url())) reads += 1;
    });
    await page.goto("/notifications");
    await expect(
      page.getByRole("heading", { name: "Notifications" }),
    ).toBeVisible();
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list).toContainText("Ta matinée EVCore");
    await expect(
      list.getByRole("img", { name: "non lue" }).first(),
    ).toBeVisible();
    await expect(page.getByRole("tab")).toHaveCount(0);
    expect(reads).toBe(0);
    await expect(
      page.getByRole("link", { name: "Réglables dans Compte" }),
    ).toHaveAttribute("href", "/me/account");
  });

  test("toucher la matinée la marque lue et mène à Aujourd'hui", async ({
    page,
  }) => {
    await page.goto("/notifications");
    const read = page.waitForRequest(
      (r) =>
        r.url().endsWith("/notifications/n5/read") && r.method() === "PATCH",
    );
    await page
      .getByRole("listitem")
      .filter({ hasText: "Ta matinée EVCore" })
      .getByRole("link")
      .click();
    await read;
    await expect(page).toHaveURL(/\/today$/);
  });
});
