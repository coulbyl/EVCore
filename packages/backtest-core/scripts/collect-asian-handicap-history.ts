/**
 * Collecte l'historique des cotes de handicap asiatique pour backtest.
 *
 * POURQUOI. L'Asian Handicap est le marché le moins taxé du carnet — 2,6 % à
 * 3,7 % de marge chez Pinnacle selon la ligne, contre 4,5 % sur le Match
 * Winner — et il n'a jamais été collecté, donc jamais backtesté. C'est le seul
 * endroit où un coupon à plusieurs jambes paie une marge assez faible pour
 * qu'un edge par jambe puisse la couvrir.
 *
 * La question à trancher : le biais favori/outsider, mesuré à +2,4 points sous
 * la cote 1,25 sur 285 758 jambes de 1X2, existe-t-il aussi sur l'AH ? Si oui,
 * un coupon de cinq jambes à cote 5 devient positif ; sinon la piste se ferme
 * comme les autres.
 *
 * N'ÉCRIT RIEN EN BASE. Les réponses brutes sont mises en cache sur disque,
 * le script est donc reprenable : une interruption ne redépense pas le quota
 * déjà consommé.
 *
 * Usage :
 *   pnpm --filter @evcore/backtest-core collect:asian-handicap -- --limit 1500
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = "https://v3.football.api-sports.io";
const KEY = process.env.API_FOOTBALL_KEY;
const DELAY_MS = 1200;
const BET_ID_ASIAN_HANDICAP = 4;
const DEFAULT_LIMIT = 500;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(SCRIPT_DIR, "..", "reports", "asian-handicap");
const CACHE_FILE = join(CACHE_DIR, "raw.ndjson");

type Leg = {
  bookmaker: string;
  pick: "HOME" | "AWAY";
  line: number;
  odds: number;
};

type Row = {
  fixtureId: number;
  day: string;
  competition: string;
  homeScore: number;
  awayScore: number;
  legs: Leg[];
};

function argValue(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const parsed = Number(process.argv[index + 1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Identifiants déjà collectés, pour ne jamais repayer le même appel. */
function alreadyCollected(): Set<number> {
  if (!existsSync(CACHE_FILE)) return new Set();
  const seen = new Set<number>();
  for (const line of readFileSync(CACHE_FILE, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      seen.add((JSON.parse(line) as Row).fixtureId);
    } catch {
      // Ligne tronquée par une interruption : elle sera simplement recollectée.
    }
  }
  return seen;
}

function parseLegs(bookmakers: unknown): Leg[] {
  if (!Array.isArray(bookmakers)) return [];
  const legs: Leg[] = [];
  for (const book of bookmakers as Array<Record<string, unknown>>) {
    const bets = book.bets;
    if (!Array.isArray(bets)) continue;
    const handicap = (bets as Array<Record<string, unknown>>).find(
      (bet) => bet.id === BET_ID_ASIAN_HANDICAP,
    );
    const values = handicap?.values;
    if (!Array.isArray(values)) continue;
    for (const entry of values as Array<Record<string, unknown>>) {
      const matched = /^(Home|Away)\s*([+-]?\d+(?:\.\d+)?)$/i.exec(
        String(entry.value).trim(),
      );
      const odds = Number(entry.odd);
      if (!matched || !Number.isFinite(odds) || odds <= 1) continue;
      const [, side, rawLine] = matched;
      if (!side || rawLine === undefined) continue;
      legs.push({
        bookmaker: String(book.name),
        pick: side.toUpperCase() === "HOME" ? "HOME" : "AWAY",
        line: Number(rawLine),
        odds,
      });
    }
  }
  return legs;
}

async function main(): Promise<void> {
  if (!KEY) {
    console.error("API_FOOTBALL_KEY absente de l'environnement.");
    process.exitCode = 1;
    return;
  }
  const limit = argValue("limit", DEFAULT_LIMIT);
  mkdirSync(CACHE_DIR, { recursive: true });
  const seen = alreadyCollected();

  const { prisma } = await import("@evcore/db");
  let fixtures: Array<{
    externalId: number;
    scheduledAt: Date;
    homeScore: number | null;
    awayScore: number | null;
    season: { competition: { code: string } };
  }>;
  try {
    // Réparties sur toutes les rencontres terminées et cotées : un échantillon
    // concentré sur une poignée de championnats ne dirait rien du biais.
    fixtures = await prisma.fixture.findMany({
      where: {
        status: "FINISHED",
        homeScore: { not: null },
        awayScore: { not: null },
        oddsSnapshots: { some: {} },
      },
      orderBy: { scheduledAt: "desc" },
      take: limit * 3,
      select: {
        externalId: true,
        scheduledAt: true,
        homeScore: true,
        awayScore: true,
        season: { select: { competition: { select: { code: true } } } },
      },
    });
  } finally {
    await prisma.$disconnect();
  }

  const pending = fixtures.filter((row) => !seen.has(row.externalId));
  const batch = pending.slice(0, limit);
  console.log(
    `${seen.size} rencontres déjà en cache, ${batch.length} à collecter (quota : ~${batch.length} appels).`,
  );

  let collected = 0;
  let withHandicap = 0;
  for (const fixture of batch) {
    const response = await fetch(
      `${BASE}/odds?fixture=${fixture.externalId}`,
      { headers: { "x-apisports-key": KEY } },
    );
    const body = (await response.json()) as {
      response?: Array<{ bookmakers?: unknown }>;
    };
    await sleep(DELAY_MS);
    const legs = parseLegs(body.response?.[0]?.bookmakers);
    const row: Row = {
      fixtureId: fixture.externalId,
      day: fixture.scheduledAt.toISOString().slice(0, 10),
      competition: fixture.season.competition.code,
      homeScore: fixture.homeScore ?? 0,
      awayScore: fixture.awayScore ?? 0,
      legs,
    };
    appendFileSync(CACHE_FILE, `${JSON.stringify(row)}\n`);
    collected += 1;
    if (legs.length > 0) withHandicap += 1;
    if (collected % 50 === 0) {
      console.log(
        `  ${collected}/${batch.length} — ${withHandicap} avec handicap asiatique`,
      );
    }
  }

  console.log(
    `\n${collected} rencontres collectées, ${withHandicap} servent l'Asian Handicap.`,
  );
  console.log(`Cache : ${CACHE_FILE}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
