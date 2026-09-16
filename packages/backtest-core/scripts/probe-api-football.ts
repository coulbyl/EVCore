/**
 * Sonde d'exploration API-Football — inventaire de ce que le plan donne
 * réellement, avant de décider quoi ingérer.
 *
 * Ne collecte rien en base et n'écrit rien : elle imprime la FORME des
 * réponses (compteurs, clés, books et marchés disponibles), jamais la clé.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core probe:api-football
 *
 * La clé est lue dans API_FOOTBALL_KEY depuis l'environnement (le script est
 * lancé avec --env-file). Elle n'est ni affichée, ni journalisée, ni écrite.
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
