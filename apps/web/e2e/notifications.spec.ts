import { expect, test } from "@playwright/test";

/**
 * La cloche (09 § 6, maquette Cloche) : le compte des non-lues sur la
 * cloche, une liste sans onglet (des puces de filtre, des liens) ; ouvrir
 * ne marque rien, toucher une ligne la marque lue et mène où elle parle.
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

/**
 * Les filtres (demandés le 04/11) : Toutes · Non lues · Lues pour tous,
 * Tout · Joueur · Alertes techniques pour l'admin (le compte du faux
 * backend est un admin). Filtrés par le serveur, gardés dans l'adresse.
 */
test.describe("Notifications — filtres", () => {
  test("Non lues : le compte sur la puce, seules les non lues", async ({
    page,
  }) => {
    await page.goto("/notifications");
    const status = page.getByRole("navigation", { name: "Afficher" });
    await expect(status.getByRole("link", { name: "Toutes" })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await status.getByRole("link", { name: /^Non lues · \d+$/ }).click();
    await expect(page).toHaveURL(/\/notifications\?status=unread$/);
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list).toContainText("Ta matinée EVCore");
    await expect(list).not.toContainText("Ta semaine EVCore");
    await expect(
      status.getByRole("link", { name: /^Non lues/ }),
    ).toHaveAttribute("aria-current", "true");
  });

  test("Lues : seules les lues", async ({ page }) => {
    await page.goto("/notifications?status=read");
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list).toContainText("Ta semaine EVCore");
    await expect(list).not.toContainText("Ta matinée EVCore");
    await expect(
      page.getByRole("button", { name: "Tout marquer comme lu" }),
    ).toHaveCount(0);
  });

  test("Alertes techniques (admin) : à part, en deux lignes, vers leur écran", async ({
    page,
  }) => {
    await page.goto("/notifications");
    await page
      .getByRole("navigation", { name: "Sorte" })
      .getByRole("link", { name: "Alertes techniques" })
      .click();
    await expect(page).toHaveURL(/\/notifications\?kind=technical$/);
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list).toContainText("Stats Sync — 20 fixtures sans xG");
    await expect(list).not.toContainText("Ta matinée EVCore");
    const report = list
      .getByRole("listitem")
      .filter({ hasText: "Stats Sync" })
      .getByRole("link");
    await expect(report).toHaveAttribute("href", "/admin/exploitation");
    // The raw ids are clamped to two lines, never the whole row.
    await expect(report.locator(".line-clamp-2")).toHaveCount(1);
  });

  test("Tout marquer comme lu : un seul appel, dans le filtre affiché", async ({
    page,
  }) => {
    await page.goto("/notifications?kind=technical");
    const readAll = page.waitForRequest(
      (r) =>
        r.url().endsWith("/notifications/read-all?category=technical") &&
        r.method() === "POST",
    );
    await page.getByRole("button", { name: "Tout marquer comme lu" }).click();
    await readAll;
  });
});

/**
 * La cloche suit la lecture sans attendre que l'écran soit redessiné : la
 * colonne gauche vit dans le layout, qu'aucune navigation ne redessine.
 */
test.describe("Notifications — la cloche synchronisée", () => {
  test("lire dans un onglet fait baisser la cloche de l'autre", async ({
    context,
  }) => {
    const bell = context.pages()[0] ?? (await context.newPage());
    await bell.goto("/today");
    await expect(
      bell.getByRole("link", { name: /^Notifications, \d+ non lues$/ }).first(),
    ).toBeVisible();

    await context.route("**/notifications/unread-count", (route) =>
      route.fulfill({ json: { count: 0 } }),
    );
    const reader = await context.newPage();
    await reader.goto("/notifications");
    await reader
      .getByRole("listitem")
      .filter({ hasText: "Ta matinée EVCore" })
      .getByRole("link")
      .click();
    await expect(reader).toHaveURL(/\/today$/);
    // /today's server count (the mock never marks anything read) only seeds
    // an empty bell: it never raises the badge back over the tab's reading.
    await expect(
      reader.getByRole("link", { name: "Notifications", exact: true }).first(),
    ).toBeVisible();

    await expect(
      bell.getByRole("link", { name: "Notifications", exact: true }).first(),
    ).toBeVisible();
  });

  test("revenir sur l'onglet relit le compte (une notification arrivée sans push)", async ({
    page,
  }) => {
    await page.goto("/today");
    await page.route("**/notifications/unread-count", (route) =>
      route.fulfill({ json: { count: 7 } }),
    );
    const badge = page
      .getByRole("link", { name: "Notifications, 7 non lues" })
      .first();
    // Until the page is hydrated, nobody listens: dispatch until heard.
    await expect(async () => {
      await page.evaluate(() =>
        document.dispatchEvent(new Event("visibilitychange")),
      );
      await expect(badge).toBeVisible({ timeout: 1_000 });
    }).toPass();
  });
});

/**
 * A tapped push opens its page with ?n=<id> (public/sw.js, N4 of the perf
 * lot): the screen marks that notification read and drops the parameter.
 */
test.describe("Push touché", () => {
  test("marque sa notification lue et nettoie l'adresse", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "player",
        domain: "localhost",
        path: "/",
      },
    ]);
    const read = page.waitForRequest(
      (request) =>
        request.url().endsWith("/notifications/notif-push-1/read") &&
        request.method() === "PATCH",
    );
    await page.goto("/today?from=morning&n=notif-push-1");
    await read;
    // The morning visit is counted and `from` dropped (lot 4), `n` read.
    await expect(page).toHaveURL(/\/today$/);
  });
});
