/**
 * Sonde d'exploration API-Football — inventaire de ce que le plan donne
 * réellement, avant de décider quoi ingérer.
 *
 * Ne collecte rien en base et n'écrit rien : elle imprime la FORME des
 * réponses (compteurs, clés, books et marchés disponibles), jamais la clé.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core probe:api-football
 *   pnpm --filter @evcore/backtest-core probe:extras  (marchés hors buts)
 *   pnpm --filter @evcore/backtest-core probe:inventory  (tous les marchés,
 *     par book, sur dix championnats)
 *
 * La clé est lue dans API_FOOTBALL_KEY depuis l'environnement. Depuis le
 * 01/11 elle vit dans Réglages › Intégrations, plus dans le .env : la passer
 * au lancement (`API_FOOTBALL_KEY=… pnpm …`). Elle n'est ni affichée, ni
 * journalisée, ni écrite.
 */
const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY;
/** Rencontre terminée récente (PL) et rencontre à venir, pour comparer. */
const FIXTURE_PAST = 1557404;
const FIXTURE_NEXT = 1514462;
const DELAY_MS = 1500;

type ApiResult = {
  ok: boolean;
  status: number;
  errors: unknown;
  results: number;
  response: unknown;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function hasError(errors: unknown): boolean {
  if (!errors) return false;
  if (Array.isArray(errors)) return errors.length > 0;
  if (typeof errors === "object") return Object.keys(errors).length > 0;
  return true;
}

async function get(path: string): Promise<ApiResult> {
  const response = await fetch(BASE + path, {
    headers: { "x-apisports-key": KEY ?? "" },
  });
  const body = (await response.json()) as {
    errors?: unknown;
    results?: number;
    response?: unknown;
  };
  await sleep(DELAY_MS);
  const failed = hasError(body.errors);
  return {
    ok: response.status === 200 && !failed,
    status: response.status,
    errors: failed ? body.errors : null,
    results: body.results ?? 0,
    response: body.response ?? [],
  };
}

function line(label: string, value: unknown): void {
  console.log(`  ${label.padEnd(34)} ${String(value)}`);
}

function keysOf(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? keysOf(value[0]) : "(vide)";
  }
  if (value && typeof value === "object") {
    return Object.keys(value).join(", ");
  }
  return typeof value;
}

async function section(title: string, path: string): Promise<ApiResult | null> {
  console.log(`\n── ${title}`);
  console.log(`   ${path}`);
  const result = await get(path);
  if (!result.ok) {
    line("ERREUR", JSON.stringify(result.errors));
    return null;
  }
  line("résultats", result.results);
  return result;
}

function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function named(value: unknown): string {
  const rows = asArray(value);
  return rows.map((row) => `${String(row.id)}:${String(row.name)}`).join(", ");
}

async function probePlan(): Promise<void> {
  const result = await section("Plan et quota", "/status");
  const account = result?.response;
  if (!account || Array.isArray(account) || typeof account !== "object") return;
  const record = account as Record<string, Record<string, unknown>>;
  line("abonnement", record.subscription?.plan ?? "?");
  line("fin d'abonnement", record.subscription?.end ?? "?");
  line(
    "requêtes du jour",
    `${String(record.requests?.current ?? "?")} / ${String(record.requests?.limit_day ?? "?")}`,
  );
}

async function probeCatalogue(): Promise<void> {
  const books = await section("Books disponibles", "/odds/bookmakers");
  if (books) line("liste", named(books.response));
  const bets = await section("Types de paris disponibles", "/odds/bets");
  if (bets) {
    const rows = asArray(bets.response);
    line("nombre de marchés", rows.length);
    line("30 premiers", named(rows.slice(0, 30)));
  }
}

async function probeOdds(fixture: number, title: string): Promise<void> {
  const odds = await section(title, `/odds?fixture=${fixture}`);
  const first = asArray(odds?.response)[0];
  if (!first) return;
  line("mise à jour", first.update ?? "?");
  const books = asArray(first.bookmakers);
  line("books servis", books.length);
  for (const book of books) {
    line(`  ${String(book.name)}`, `${asArray(book.bets).length} marchés`);
  }
  const pinnacle = books.find((book) => book.name === "Pinnacle");
  if (pinnacle) {
    line(
      "  marchés Pinnacle (30 max)",
      asArray(pinnacle.bets)
        .slice(0, 30)
        .map((bet) => String(bet.name))
        .join(" | "),
    );
  }
}

async function probeTeamNews(): Promise<void> {
  const injuries = await section(
    "Blessures sur une rencontre",
    `/injuries?fixture=${FIXTURE_PAST}`,
  );
  const injuryRows = asArray(injuries?.response);
  if (injuryRows.length > 0) {
    line("champs", keysOf(injuryRows));
    line("champs joueur", keysOf(injuryRows[0]?.player));
    line("exemple", JSON.stringify(injuryRows[0]?.player));
  }

  const lineups = await section(
    "Compositions sur une rencontre",
    `/fixtures/lineups?fixture=${FIXTURE_PAST}`,
  );
  const lineupRows = asArray(lineups?.response);
  if (lineupRows.length > 0) {
    const head = lineupRows[0];
    line("champs", keysOf(lineupRows));
    line("formation", head?.formation ?? "?");
    line("titulaires", asArray(head?.startXI).length);
    line("remplaçants", asArray(head?.substitutes).length);
  }

  const stats = await section(
    "Statistiques de match",
    `/fixtures/statistics?fixture=${FIXTURE_PAST}`,
  );
  const statRows = asArray(stats?.response);
  if (statRows.length > 0) {
    line(
      "types disponibles",
      asArray(statRows[0]?.statistics)
        .map((item) => String(item.type))
        .join(" | "),
    );
  }

  const predictions = await section(
    "Prédictions fournies par l'API",
    `/predictions?fixture=${FIXTURE_PAST}`,
  );
  if (predictions) line("champs", keysOf(predictions.response));
}

/** Marchés hors buts : tirs, fautes, hors-jeu, corners, cartons, joueurs… */
const EXTRAS =
  /shot|foul|offside|card|corner|save|throw|goal ?kick|tackle|possession|booking|player|scorer/i;
/** Premier championnat de chaque grand pays : PL, Liga, Serie A, Bundesliga, Ligue 1. */
const EXTRAS_LEAGUES = [39, 140, 135, 78, 61];
const EXTRAS_BOOKS = ["1xBet", "Pinnacle", "Bet365"];

/**
 * `--extras` (lot 6, 2026-10-29) : l'inventaire des marchés hors buts, puis
 * ce que 1xBet, Pinnacle et Bet365 cotent réellement sur le prochain match
 * de cinq grands championnats. Une douzaine de requêtes.
 */
async function probeExtras(): Promise<void> {
  const bets = await section("Types de paris « extras »", "/odds/bets");
  const extras = asArray(bets?.response).filter((bet) =>
    EXTRAS.test(String(bet.name)),
  );
  line("nombre", extras.length);
  for (const bet of extras) line(`  ${String(bet.id)}`, String(bet.name));

  for (const league of EXTRAS_LEAGUES) {
    const fixtures = await section(
      `Prochain match, championnat ${league}`,
      `/fixtures?league=${league}&next=1`,
    );
    const fixture = asArray(fixtures?.response)[0]?.fixture as
      | Record<string, unknown>
      | undefined;
    if (!fixture) continue;
    line("match", `${String(fixture.id)} le ${String(fixture.date)}`);
    const odds = await section(
      `Cotes du match ${String(fixture.id)}`,
      `/odds?fixture=${String(fixture.id)}`,
    );
    const books = asArray(asArray(odds?.response)[0]?.bookmakers);
    for (const name of EXTRAS_BOOKS) {
      const book = books.find((candidate) => candidate.name === name);
      if (!book) {
        line(`  ${name}`, "absent");
        continue;
      }
      const all = asArray(book.bets);
      const found = all.filter((bet) => EXTRAS.test(String(bet.name)));
      line(`  ${name}`, `${all.length} marchés, ${found.length} extras`);
      for (const bet of found) {
        const values = asArray(bet.values);
        line(
          `    ${String(bet.id)} ${String(bet.name)}`,
          `${values.length} issues : ${values
            .slice(0, 4)
            .map((value) => `${String(value.value)} @${String(value.odd)}`)
            .join(", ")}`,
        );
      }
    }
  }
}

/** PL, Liga, Serie A, Bundesliga, Ligue 1, Portugal, Pays-Bas, C1, MLS, Brésil. */
const INVENTORY_LEAGUES = [39, 140, 135, 78, 61, 94, 88, 2, 253, 71];

/**
 * `--inventory` (2026-11-03) : tous les types de paris de l'API, et pour
 * chacun, sur le prochain match de dix championnats, combien de matchs le
 * cotent chez chaque book et quels libellés il porte. Une vingtaine de
 * requêtes ; la sortie est un tableau Markdown, rien n'est écrit en base.
 */
async function probeInventory(): Promise<void> {
  const catalogue = await section("Types de paris", "/odds/bets");
  const names = new Map(
    asArray(catalogue?.response).map((bet) => [
      Number(bet.id),
      String(bet.name),
    ]),
  );
  line("types de paris", names.size);

  // bet id → book → matchs qui le cotent ; bet id → libellés vus.
  const quoted = new Map<number, Map<string, number>>();
  const labels = new Map<number, Set<string>>();
  let matches = 0;
  for (const league of INVENTORY_LEAGUES) {
    const fixtures = await get(`/fixtures?league=${league}&next=1`);
    const fixture = asArray(fixtures.response)[0]?.fixture as
      | Record<string, unknown>
      | undefined;
    if (!fixture) continue;
    const odds = await get(`/odds?fixture=${String(fixture.id)}`);
    const books = asArray(asArray(odds.response)[0]?.bookmakers);
    if (books.length === 0) continue;
    matches += 1;
    for (const book of books) {
      for (const bet of asArray(book.bets)) {
        const id = Number(bet.id);
        const perBook = quoted.get(id) ?? new Map<string, number>();
        perBook.set(
          String(book.name),
          (perBook.get(String(book.name)) ?? 0) + 1,
        );
        quoted.set(id, perBook);
        const seen = labels.get(id) ?? new Set<string>();
        for (const value of asArray(bet.values).slice(0, 6)) {
          seen.add(String(value.value));
        }
        labels.set(id, seen);
      }
    }
  }

  console.log(`\n## Marchés cotés sur ${matches} matchs à venir\n`);
  console.log("| id | Pari | Books (matchs cotés) | Libellés vus |");
  console.log("| ---: | --- | --- | --- |");
  const ids = [...quoted.keys()].sort((a, b) => a - b);
  for (const id of ids) {
    const books = [...(quoted.get(id) ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => `${name} ${count}`)
      .join(", ");
    const seen = [...(labels.get(id) ?? new Set<string>())]
      .slice(0, 6)
      .join(" · ");
    console.log(`| ${id} | ${names.get(id) ?? "?"} | ${books} | ${seen} |`);
  }
  const never = [...names.entries()].filter(([id]) => !quoted.has(id));
  console.log(`\n## Types jamais cotés sur ces matchs (${never.length})\n`);
  console.log(never.map(([id, name]) => `${id} ${name}`).join(" · "));
}

async function main(): Promise<void> {
  if (!KEY) {
    console.error("API_FOOTBALL_KEY absente de l'environnement.");
    process.exitCode = 1;
    return;
  }
  console.log(
    "Sonde API-Football — la clé est lue dans l'environnement, jamais affichée.",
  );
  await probePlan();
  if (process.argv.includes("--inventory")) {
    await probeInventory();
    console.log("\nFin de la sonde.");
    return;
  }
  if (process.argv.includes("--extras")) {
    await probeExtras();
    console.log("\nFin de la sonde.");
    return;
  }
  await probeCatalogue();
  await probeOdds(FIXTURE_PAST, "Cotes sur une rencontre passée");
  await probeTeamNews();
  await probeOdds(FIXTURE_NEXT, "Cotes sur une rencontre à venir");
  await section("Cotes en direct disponibles ?", "/odds/live");
  console.log("\nFin de la sonde.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
