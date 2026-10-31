import { expect, test } from "@playwright/test";

/**
 * « Messages » (09 § 2, maquette Messages) : une seule conversation avec
 * l'équipe, rendue côté serveur ; le composeur écrit, joint une photo, et
 * garde un message qui n'est pas parti avec « Réessayer ».
 */
test.describe("Messages", () => {
  test("le fil : l'accueil automatique, ma question et sa photo, la réponse signée", async ({
    page,
  }) => {
    const read = page.waitForRequest(
      (r) => r.url().endsWith("/support/read") && r.method() === "POST",
    );
    await page.goto("/me/messages");
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(
      page.getByText("l'équipe EVCore · répond en quelques heures"),
    ).toBeVisible();
    const thread = page.getByRole("list", { name: "Messages" });
    await expect(thread).toContainText(
      "Bienvenue. Écris-nous, on répond généralement en quelques heures.",
    );
    await expect(thread).toContainText("automatique");
    await expect(
      thread.getByRole("img", { name: "Photo jointe" }),
    ).toBeVisible();
    await expect(thread).toContainText("L'équipe EVCore");
    // A reply not read yet: opening the thread marks it read.
    await read;
    await expect(
      page.getByRole("link", { name: "Retour à Moi" }),
    ).toHaveAttribute("href", "/me");
  });

  test("écrire à l'équipe : le message part et reste dans le fil", async ({
    page,
  }) => {
    await page.goto("/me/messages");
    const field = page.getByRole("textbox", { name: "Écris à l'équipe…" });
    const text = `Une question du test ${Date.now()}`;
    await field.fill(text);
    const sent = page.waitForRequest(
      (r) => r.url().endsWith("/support/messages") && r.method() === "POST",
    );
    await page.getByRole("button", { name: "Envoyer" }).click();
    expect((await sent).postDataJSON()).toEqual({ content: text });
    await expect(page.getByText(text)).toBeVisible();
    await expect(field).toHaveValue("");
    await page.reload();
    await expect(page.getByText(text)).toBeVisible();
  });

  test("une photo qui ne part pas reste, avec « Réessayer »", async ({
    page,
  }) => {
    await page.goto("/me/messages");
    await page.locator('input[type="file"]').setInputFiles({
      name: "capture.png",
      mimeType: "image/png",
      buffer: Buffer.from("89504e470d0a1a0a", "hex"),
    });
    await expect(page.getByText("Pas envoyé")).toBeVisible();
    await expect(page.getByRole("button", { name: "Réessayer" })).toBeVisible();
  });
});
