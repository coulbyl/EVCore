import { expect, test } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

/** Les écrans du visiteur en anglais (10 § 6), par le cookie de langue. */
test.describe("In English", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", domain: "localhost", path: "/" },
    ]);
  });

  test("the landing", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "One bet a day. Counted, dated, losses included.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Create my account" }),
    ).toBeVisible();
  });

  test("sign-in and sign-up, title included", async ({ page }) => {
    await page.goto("/auth/login");
    await expect(page).toHaveTitle("Sign in — EVCore");
    await expect(page.getByLabel("Password")).toBeVisible();
    await page.goto("/auth/register");
    await expect(page).toHaveTitle("Create my account — EVCore");
    await page.getByRole("button", { name: "Create my account" }).click();
    await expect(page.getByText("Enter your first name.")).toBeVisible();
  });
});
