import { expect, test, type Page } from "@playwright/test";

/**
 * « Vérifie ton ticket » (07 § 2–4, maquettes MatchsTicket et Ticket) : les
 * [+] de la fiche de match, la barre au-dessus des onglets, la feuille qui
 * cote le ticket sur le serveur. Le ticket vit dans le navigateur.
 */
const ARSENAL = "00000000-0000-4000-8000-617273000000";
const LAZIO = "00000000-0000-4000-8000-6c617a000000";

const sheetNamed = (page: Page, name: string) =>
  page
    .getByRole("dialog", { name })
    .or(page.getByRole("complementary", { name }));

/** The bar above the tabs. */
const bar = (page: Page) =>
  page.getByRole("link", { name: "Ouvrir mon ticket" });

async function add(page: Page, fixtureId: string, bet: string) {
  await page.goto(`/matches/${fixtureId}`);
  await page
    .getByRole("button", { name: `Ajouter à mon ticket – ${bet}` })
    .first()
    .click();
}

test.describe("Mon ticket", () => {
  test("le [+] de la fiche ajoute le pari ; la barre et la coche apparaissent", async ({
    page,
  }) => {
    await page.goto("/matches");
    await expect(bar(page)).toHaveCount(0);

    await add(page, ARSENAL, "Victoire Arsenal");
    await expect(
      page.getByRole("button", { name: "Dans mon ticket – Victoire Arsenal" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.goto("/matches");
    await expect(bar(page)).toContainText("Mon ticket");
    await expect(bar(page)).toContainText("1 match");
    await expect(bar(page)).toContainText("6 sur 10");
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "Arsenal – Chelsea" });
    await expect(
      row.getByRole("img", { name: "Dans mon ticket" }),
    ).toBeVisible();
    const lyon = page.getByRole("listitem").filter({ hasText: "Lyon – Lens" });
    await expect(
      lyon.getByRole("img", { name: "Dans mon ticket" }),
    ).toBeHidden();

    // Pas sur les autres onglets.
    await page.goto("/results");
    await expect(bar(page)).toHaveCount(0);
  });

  test("la feuille : les paris, la cote totale, les chances, ce que 1xBet garde, notre coupon", async ({
    page,
  }) => {
    await add(page, ARSENAL, "Victoire Arsenal");
    await add(page, LAZIO, "Match nul");
    await page.goto("/matches");
    await expect(bar(page)).toContainText("2 matchs");
    await expect(bar(page)).toContainText("5,61");
    await expect(bar(page)).toContainText("environ 1 fois sur 6");

    const counted = page.waitForRequest(
      (request) =>
        request.url().endsWith("/ticket/quote") &&
        request.postDataJSON()?.verify === true,
    );
    await bar(page).click();
    await counted;
    const sheet = sheetNamed(page, "Mon ticket");
    await expect(sheet).toBeVisible();
    const legs = sheet.getByRole("listitem");
    await expect(legs).toHaveCount(2);
    await expect(legs.first()).toContainText("Victoire Arsenal");
    // 1,60 à l'ajout, 1,70 maintenant : plus de 5 %.
    await expect(legs.first()).toContainText("1,70");
    await expect(legs.first()).toContainText("cote mise à jour");
    await expect(sheet.getByText("Cote totale")).toBeVisible();
    await expect(
      sheet.getByRole("img", { name: "1 chance sur 6" }),
    ).toBeVisible();
    await expect(
      sheet.getByText(
        /^Sur la durée, 1xBet garde 6\s%\sde ta mise sur ce ticket$/,
      ),
    ).toBeVisible();
    await expect(
      sheet.getByRole("link", { name: /Notre Favori du jour/ }),
    ).toContainText("8 sur 10");

    // Rouvrir la même composition le même jour ne la recompte pas.
    await page.goto("/matches");
    const again = page.waitForRequest((request) =>
      request.url().endsWith("/ticket/quote"),
    );
    await bar(page).click();
    expect((await again).postDataJSON()?.verify).toBeUndefined();
  });

  test("un seul pari par match : le second remplace le premier", async ({
    page,
  }) => {
    await add(page, ARSENAL, "Victoire Arsenal");
    await page
      .getByRole("button", { name: "Ajouter à mon ticket – Match nul" })
      .first()
      .click();
    await expect(page.getByText("Un seul pari par match")).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: "Ajouter à mon ticket – Victoire Arsenal",
      }),
    ).toBeVisible();
    await page.goto("/matches");
    await expect(bar(page)).toContainText("1 match");
  });

  test("retirer un pari, vider le ticket", async ({ page }) => {
    await add(page, ARSENAL, "Victoire Arsenal");
    await add(page, LAZIO, "Match nul");
    await page.goto("/ticket");
    const sheet = sheetNamed(page, "Mon ticket");
    await sheet
      .getByRole("button", { name: "Retirer Victoire Arsenal" })
      .click();
    await expect(sheet.getByRole("listitem")).toHaveCount(1);
    await sheet.getByRole("button", { name: "Vider" }).click();
    await expect(
      sheet.getByText("Ajoute des paris depuis les matchs"),
    ).toBeVisible();
    await expect(
      sheet.getByRole("link", { name: "Voir les matchs" }),
    ).toBeVisible();
  });

  test("15 au plus", async ({ page }) => {
    await page.addInitScript(() => {
      const legs = Array.from({ length: 15 }, (_, n) => ({
        fixtureId: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
        market: "ONE_X_TWO",
        pick: "HOME",
        label: `Pari ${n}`,
        home: { name: `Équipe ${n}`, shortName: "EQU", logoUrl: null },
        away: { name: "Autre", shortName: "AUT", logoUrl: null },
        kickoffAt: new Date(Date.now() + 86_400_000).toISOString(),
        odds: 1.3,
      }));
      window.localStorage.setItem(
        "evcore.ticket.v1",
        JSON.stringify({ legs, quote: null, counted: null }),
      );
    });
    await page.goto(`/matches/${ARSENAL}`);
    await expect(
      sheetNamed(page, "Arsenal – Chelsea").getByText("15 au plus").first(),
    ).toBeVisible();
  });

  test("pause : pas de barre, le ticket reste sur l'appareil", async ({
    page,
    context,
  }) => {
    await add(page, ARSENAL, "Victoire Arsenal");
    await context.addCookies([
      {
        name: "evcore_session",
        value: "today-paused",
        domain: "localhost",
        path: "/",
      },
    ]);
    await page.goto("/today");
    await expect(page.getByText(/En pause jusqu'au/)).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    expect(
      await page.evaluate(() => localStorage.getItem("evcore.ticket.v1")),
    ).toContain("Victoire Arsenal");
  });
});

/** A ticket of yesterday kept on the device (its matches are over). */
async function seedYesterday(
  page: Page,
  legs: { id: string; label: string; home: string; away: string }[],
  checked: { odds: number; chance: number } | null,
) {
  await page.addInitScript(
    ({ legs, checked }) => {
      const yesterday = new Date(Date.now() - 86_400_000);
      yesterday.setUTCHours(18, 0, 0, 0);
      const stored = legs.map((leg) => ({
        fixtureId: leg.id,
        market: "ONE_X_TWO",
        pick: "HOME",
        label: leg.label,
        home: { name: leg.home, shortName: "HOM", logoUrl: null },
        away: { name: leg.away, shortName: "AWA", logoUrl: null },
        kickoffAt: yesterday.toISOString(),
        odds: 1.5,
      }));
      const key = stored
        .map((leg) => `${leg.fixtureId}|ONE_X_TWO|HOME`)
        .sort()
        .join(",");
      if (window.sessionStorage.getItem("seeded")) return;
      window.sessionStorage.setItem("seeded", "1");
      window.localStorage.setItem(
        "evcore.ticket.v1",
        JSON.stringify({
          legs: stored,
          quote: null,
          counted: null,
          checked: checked
            ? {
                key,
                totals: { legCount: legs.length, keep: 0.3, ...checked },
              }
            : null,
        }),
      );
    },
    { legs, checked },
  );
}

const PSG_YESTERDAY = {
  id: "00000000-0000-4000-8000-792d70736700",
  label: "Victoire Paris SG",
  home: "Paris SG",
  away: "Lens",
};
const INTER_YESTERDAY = {
  id: "00000000-0000-4000-8000-792d696e7400",
  label: "Victoire Inter",
  home: "Inter",
  away: "Napoli",
};

test.describe("Mon ticket, le lendemain et le partage (07 § 5–6)", () => {
  test("le ticket d'hier perdu : « il fallait les 2 », jamais combien sont passés, puis il se vide", async ({
    page,
  }) => {
    await seedYesterday(page, [PSG_YESTERDAY, INTER_YESTERDAY], {
      odds: 2.25,
      chance: 0.36,
    });
    await page.goto("/matches");
    await expect(bar(page)).toContainText("Ton ticket d'hier");
    await expect(bar(page)).toContainText("perdu");

    await bar(page).click();
    const sheet = sheetNamed(page, "Mon ticket");
    await expect(sheet.getByText("Ton ticket d'hier")).toBeVisible();
    await expect(sheet).toContainText("2 matchs · cote 2,25");
    await expect(sheet.getByText("perdu", { exact: true })).toBeVisible();
    await expect(sheet.getByText("il fallait les 2")).toBeVisible();
    await expect(sheet).not.toContainText(/passé|sur 2 passés/);
    const psg = sheet
      .getByRole("listitem")
      .filter({ hasText: "Victoire Paris SG" });
    await expect(psg).toContainText("2–0");
    await expect(psg.getByRole("img", { name: "gagné" })).toBeVisible();
    const inter = sheet
      .getByRole("listitem")
      .filter({ hasText: "Victoire Inter" });
    await expect(inter.getByRole("img", { name: "perdu" })).toBeVisible();
    await expect(sheet).toContainText("Notre Favori d'hier :");
    await expect(sheet).toContainText("Paris SG – Lens 2–0 · 1,24");

    // Shown once: the device's ticket is now empty.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem("evcore.ticket.v1")))
      .toContain('"legs":[]');
    await sheet
      .getByRole("link", { name: "Composer celui d'aujourd'hui" })
      .click();
    await expect(page).toHaveURL(/\/matches$/);
    await expect(bar(page)).toHaveCount(0);
  });

  test("le ticket d'hier gagné : « 1 fois sur 46, c'était celle-là »", async ({
    page,
  }) => {
    await seedYesterday(page, [PSG_YESTERDAY], { odds: 1.5, chance: 1 / 46 });
    await page.goto("/ticket");
    const sheet = sheetNamed(page, "Mon ticket");
    await expect(sheet.getByText("gagné", { exact: true })).toBeVisible();
    await expect(
      sheet.getByText("1 fois sur 46, c'était celle-là"),
    ).toBeVisible();
  });

  test("un [+] sur le ticket d'hier commence celui d'aujourd'hui", async ({
    page,
  }) => {
    await seedYesterday(page, [PSG_YESTERDAY, INTER_YESTERDAY], null);
    await add(page, ARSENAL, "Victoire Arsenal");
    await page.goto("/matches");
    await expect(bar(page)).toContainText("Mon ticket");
    await expect(bar(page)).toContainText("1 match");
  });

  test("Partager mes chances : une image PNG du ticket", async ({ page }) => {
    // No share sheet in the test browser: the image is downloaded.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "canShare", { value: undefined });
    });
    await add(page, ARSENAL, "Victoire Arsenal");
    await add(page, LAZIO, "Match nul");
    await page.goto("/ticket");
    const sheet = sheetNamed(page, "Mon ticket");
    await expect(sheet.getByText("Cote totale")).toBeVisible();
    const download = page.waitForEvent("download");
    await sheet.getByRole("button", { name: "Partager mes chances" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("evcore-ticket.png");
    const path = await file.path();
    const { readFileSync } = await import("node:fs");
    const png = readFileSync(path);
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(png.length).toBeGreaterThan(20_000);
  });
});
