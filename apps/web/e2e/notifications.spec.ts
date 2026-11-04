import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

/**
 * The reads are server actions: Next writes them to the fake backend from
 * Node, out of the browser's sight. The fake backend keeps them (a read row
 * stays read, the count follows) until it is reset, and lists them.
 */
const MOCK = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 3099}`;

async function resetBell(request: APIRequestContext) {
  await request.post(`${MOCK}/__e2e/reset`);
}

async function bellCalls(request: APIRequestContext) {
  const stats = (await (await request.get(`${MOCK}/__e2e/stats`)).json()) as {
    notificationReads: string[];
    readAllCalls: string[];
  };
  return stats;
}

/** Another device reads a row: the fake backend marks it, no tab knows. */
async function readElsewhere(request: APIRequestContext, id: string) {
  await request.patch(`${MOCK}/notifications/${id}/read`);
}

/** The bell on screen (the band's on a phone, the rail's on a computer). */
const bell = (page: Page) =>
  page.locator("a[href='/notifications']:visible").first();

const unreadLabel = (count: number) =>
  count > 0 ? `Notifications, ${count} non lues` : "Notifications";

test.beforeEach(async ({ request }) => resetBell(request));
test.afterEach(async ({ request }) => resetBell(request));

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
    request,
  }) => {
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
    expect((await bellCalls(request)).notificationReads).toEqual([]);
    await expect(
      page.getByRole("link", { name: "Réglables dans Compte" }),
    ).toHaveAttribute("href", "/me/account");
  });

  test("toucher la matinée la marque lue et mène à Aujourd'hui, la cloche baissée", async ({
    page,
    request,
  }) => {
    await page.goto("/notifications");
    // The admin of the fake backend: the morning, an announcement, an alert.
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(3));
    await page
      .getByRole("listitem")
      .filter({ hasText: "Ta matinée EVCore" })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/today$/);
    // Today's band and the rail drawn by the same action: one fewer.
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(2));
    expect((await bellCalls(request)).notificationReads).toEqual(["n5"]);
    // The history: Notifications is behind Today, as after a tap on a link.
    await page.goBack();
    await expect(page).toHaveURL(/\/notifications$/);
  });

  test("une annonce se lit sur place : la ligne et la cloche redessinées", async ({
    page,
    request,
  }) => {
    await page.goto("/notifications");
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "Nouvelles fiches de formation" });
    await expect(row.getByRole("img", { name: "non lue" })).toBeVisible();
    await row.getByRole("link").click();
    await expect(row.getByRole("img", { name: "non lue" })).toHaveCount(0);
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(2));
    expect((await bellCalls(request)).notificationReads).toEqual(["n1"]);
  });

  test("une ligne déjà lue est un simple lien : rien n'est écrit", async ({
    page,
    request,
  }) => {
    await page.goto("/notifications");
    await page
      .getByRole("listitem")
      .filter({ hasText: "Réponse de l'équipe" })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(/\/me\/messages$/);
    expect((await bellCalls(request)).notificationReads).toEqual([]);
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
    request,
  }) => {
    await page.goto("/notifications?kind=technical");
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list.getByRole("img", { name: "non lue" })).toHaveCount(1);
    await page.getByRole("button", { name: "Tout marquer comme lu" }).click();
    // The list and the bell drawn again with the alert read; the player's
    // rows stay unread.
    await expect(list.getByRole("img", { name: "non lue" })).toHaveCount(0);
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(2));
    await expect(
      page.getByRole("button", { name: "Tout marquer comme lu" }),
    ).toHaveCount(0);
    expect((await bellCalls(request)).readAllCalls).toEqual(["technical"]);
  });
});

/**
 * La cloche est celle de la mise en page, redessinée après une lecture :
 * dans l'onglet, dans les autres, au retour sur l'onglet, et quand la liste
 * en compte d'autres.
 */
test.describe("Notifications — la cloche synchronisée", () => {
  test("lire dans un onglet fait baisser la cloche de l'autre", async ({
    context,
  }) => {
    const other = context.pages()[0] ?? (await context.newPage());
    await other.goto("/results");
    await expect(bell(other)).toHaveAttribute("aria-label", unreadLabel(3));

    const reader = await context.newPage();
    await reader.goto("/notifications");
    await reader
      .getByRole("listitem")
      .filter({ hasText: "Ta matinée EVCore" })
      .getByRole("link")
      .click();
    await expect(reader).toHaveURL(/\/today$/);
    await expect(bell(reader)).toHaveAttribute("aria-label", unreadLabel(2));
    // The other tab hears it and draws its layout again (it is visible:
    // Playwright's pages all are).
    await expect(bell(other)).toHaveAttribute("aria-label", unreadLabel(2));
  });

  test("revenir sur l'onglet relit le compte (lu ailleurs, sans push)", async ({
    page,
    request,
  }) => {
    await page.goto("/today");
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(3));
    await readElsewhere(request, "n5");
    // Until the page is hydrated, nobody listens: hide and show until heard.
    await expect(async () => {
      await setVisibility(page, "hidden");
      await setVisibility(page, "visible");
      await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(2), {
        timeout: 1_000,
      });
    }).toPass();
  });

  test("la liste et la cloche comptent le même ensemble", async ({
    page,
    request,
  }) => {
    await page.goto("/today");
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(3));
    // Read on another device: the layout, drawn before, does not know.
    await readElsewhere(request, "n5");
    // The rail's bell sits under Next's dev indicator on a wide screen.
    await bell(page).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/notifications$/);
    const list = page.getByRole("list", { name: "Notifications" });
    await expect(list.getByRole("img", { name: "non lue" })).toHaveCount(2);
    // The list counts two: the bell is drawn again with it.
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(2));
    await expect(
      page
        .getByRole("navigation", { name: "Afficher" })
        .getByRole("link", { name: "Non lues · 2" }),
    ).toBeVisible();
  });
});

/** The tab hidden or shown, as the browser would say it. */
async function setVisibility(page: Page, state: "hidden" | "visible") {
  await page.evaluate((next) => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => next,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  }, state);
}

/**
 * A tapped push opens its page with ?n=<id> (public/sw.js, N4 of the perf
 * lot): the screen marks that notification read and drops the parameter.
 */
test.describe("Push touché", () => {
  test("marque sa notification lue et nettoie l'adresse", async ({
    page,
    context,
    request,
  }) => {
    await context.addCookies([
      {
        name: "evcore_session",
        value: "player",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/today?from=morning&n=n5");
    // The morning visit is counted and `from` dropped (lot 4), `n` read.
    await expect(page).toHaveURL(/\/today$/);
    // The fake backend serves the same bell to everyone: three unread.
    await expect(bell(page)).toHaveAttribute("aria-label", unreadLabel(2));
    // Development mounts twice: the same row, read twice at most.
    expect(new Set((await bellCalls(request)).notificationReads)).toEqual(
      new Set(["n5"]),
    );
  });
});
