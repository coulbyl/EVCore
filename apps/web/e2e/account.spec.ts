import { expect, test } from "@playwright/test";

/**
 * « Compte » (09 § 5, maquette Compte) : une page en sections — profil,
 * sécurité, notifications, affichage.
 */
test.describe("Compte", () => {
  test("le prénom se modifie sur place", async ({ page }) => {
    await page.goto("/me/account");
    await expect(page.getByRole("heading", { name: "Compte" })).toBeVisible();
    await page.getByRole("button", { name: "modifier : prénom" }).click();
    const field = page.getByLabel("prénom");
    await field.fill("Kouassi");
    const saved = page.waitForRequest(
      (r) => r.url().endsWith("/auth/me/identity") && r.method() === "PATCH",
    );
    await page.getByRole("button", { name: "Enregistrer" }).click();
    expect((await saved).postDataJSON()).toEqual({ firstName: "Kouassi" });
  });

  test("l'e-mail change avec le mot de passe puis un code", async ({
    page,
  }) => {
    await page.goto("/me/account");
    await page.getByRole("button", { name: "modifier : e-mail" }).click();
    await page.getByLabel("Nouvel e-mail").fill("nouveau@example.com");
    await page.getByLabel("Mot de passe", { exact: true }).fill("secret-123");
    const requested = page.waitForRequest((r) =>
      r.url().endsWith("/auth/me/email/request"),
    );
    await page.getByRole("button", { name: "Recevoir un code" }).click();
    expect((await requested).postDataJSON()).toEqual({
      newEmail: "nouveau@example.com",
      password: "secret-123",
    });
    await page.getByLabel("Code reçu par e-mail").fill("123456");
    const confirmed = page.waitForRequest((r) =>
      r.url().endsWith("/auth/me/email/confirm"),
    );
    await page.getByRole("button", { name: "Changer l'e-mail" }).click();
    expect((await confirmed).postDataJSON()).toEqual({ code: "123456" });
  });

  test("sécurité : le mot de passe, les appareils, déconnecter les autres", async ({
    page,
  }) => {
    await page.goto("/me/account");
    const security = page.getByRole("region", { name: "Sécurité" });
    await expect(security).toContainText("Appareils connectés 2");
    await security
      .getByRole("button", { name: "Déconnecter les autres" })
      .click();
    await expect(
      security.getByText("Autres appareils déconnectés : 1"),
    ).toBeVisible();
    await security.locator("summary", { hasText: "Mot de passe" }).click();
    await expect(
      security.getByText(
        "Tous tes appareils seront déconnectés, celui-ci aussi.",
      ),
    ).toBeVisible();
  });

  test("les notifications : quatre interrupteurs et « Par e-mail aussi »", async ({
    page,
  }) => {
    await page.goto("/me/account");
    const notifications = page.getByRole("region", { name: "Notifications" });
    await expect(notifications.getByRole("switch")).toHaveCount(5);
    const morning = notifications.getByRole("switch", { name: /Ma matinée/ });
    const before = await morning.getAttribute("aria-checked");
    const patched = page.waitForRequest(
      (r) => r.url().endsWith("/auth/me") && r.method() === "PATCH",
    );
    await morning.click();
    expect((await patched).postDataJSON()).toEqual({
      morningBriefEnabled: before !== "true",
    });
    await expect(morning).toHaveAttribute(
      "aria-checked",
      before === "true" ? "false" : "true",
    );
  });

  test("l'affichage : thème, langue, devise", async ({ page }) => {
    await page.goto("/me/account");
    const display = page.getByRole("region", { name: "Affichage" });
    await display.getByRole("radio", { name: "Sombre" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    const patched = page.waitForRequest(
      (r) =>
        r.url().endsWith("/auth/me") &&
        r.method() === "PATCH" &&
        r.postDataJSON()?.currency === "EUR",
    );
    await display.getByRole("radio", { name: "Euro" }).click();
    await patched;
  });
});
