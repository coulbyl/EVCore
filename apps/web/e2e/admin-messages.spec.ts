import { expect, test } from "@playwright/test";

/**
 * The team's Messages (12-admin § 3): the conversations in the order one
 * acts, then a thread with the player on the left and the team on the
 * right, opened as read.
 */
test.describe("Messages de l'admin", () => {
  test("la liste mène au fil, qui se marque lu", async ({ page }) => {
    await page.goto("/admin/messages");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    const read = page.waitForRequest(
      (r) =>
        r.url().endsWith("/admin/support/conversations/conv-1/read") &&
        r.method() === "POST",
    );
    await page.getByRole("link", { name: /Aya Koné/ }).click();
    await expect(page).toHaveURL(/\/admin\/messages\/conv-1/);
    await expect(page.getByRole("heading", { name: "Aya Koné" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Aya Koné" })).toContainText(
      "chez 1xBet j'avais 1,36",
    );
    await read;
    await expect(page.getByRole("link", { name: "Sa fiche" })).toHaveAttribute(
      "href",
      "/admin/players/e2e-user",
    );
  });

  test("Moi › Messages mène l'admin à ses Messages", async ({ page }) => {
    await page.goto("/me/messages");
    await expect(page).toHaveURL(/\/admin\/messages$/);
  });
});
