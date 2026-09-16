/**
 * Vérification à blanc des marchés ajoutés le 2026-09-15 (chantier A du plan
 * de rentabilité) : handicap asiatique, second-half over/under, corners,
 * cartons, pair/impair, mi-temps la plus prolifique, première équipe à
 * marquer.
 *
 * Appelle l'API sur de vraies rencontres, fait tourner les extracteurs du
 * worker et **imprime ce qui serait stocké, sans rien écrire en base**. Les
 * tests unitaires valident le parsing sur des données forgées ; ceci le
 * valide sur ce que l'API sert réellement, ce qui est le seul moyen d'attraper
 * un libellé inattendu avant qu'il ne pollue la base.
 *
 * Usage :
 *   pnpm --filter backend etl:dry-run-markets
 *
 * La clé est lue dans API_FOOTBALL_KEY, jamais affichée.
 */
import { prisma } from '@evcore/db';
import {
  extractAsianHandicapOdds,
  extractExtendedMarketOdds,
} from '../src/modules/etl/workers/odds-prematch-sync.worker';
import { ApiFootballOddsResponseSchema } from '../src/modules/etl/schemas/odds.schema';

const BASE = 'https://v3.football.api-sports.io';
const KEY = process.env.API_FOOTBALL_KEY;
const FIXTURE_COUNT = 8;
const DELAY_MS = 1300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Tally = Map<string, { legs: number; books: Set<string> }>;

function record(tally: Tally, market: string, legs: number, book: string): void {
  if (legs === 0) return;
  const entry = tally.get(market) ?? { legs: 0, books: new Set<string>() };
  entry.legs += legs;
  entry.books.add(book);
  tally.set(market, entry);
}

async function main(): Promise<void> {
  if (!KEY) {
    console.error('API_FOOTBALL_KEY absente de l’environnement.');
    process.exitCode = 1;
    return;
  }
  try {
    const fixtures = await prisma.fixture.findMany({
      where: { status: 'FINISHED', scheduledAt: { gte: new Date('2026-09-01') } },
      orderBy: { scheduledAt: 'desc' },
      take: FIXTURE_COUNT,
      select: { externalId: true },
    });
    console.log(
      `Vérification à blanc sur ${fixtures.length} rencontres — aucune écriture en base.\n`,
    );

    const tally: Tally = new Map();
    const unknownPicks = new Set<string>();

    for (const fixture of fixtures) {
      const response = await fetch(
        `${BASE}/odds?fixture=${fixture.externalId}`,
        { headers: { 'x-apisports-key': KEY } },
      );
      const parsed = ApiFootballOddsResponseSchema.safeParse(
        await response.json(),
      );
      await sleep(DELAY_MS);
      if (!parsed.success) {
        console.error(
          `  rencontre ${fixture.externalId} : réponse rejetée par Zod`,
        );
        continue;
      }
      const match = parsed.data.response[0];
      if (!match) continue;

      for (const book of match.bookmakers) {
        const asian = extractAsianHandicapOdds(match.bookmakers, book.name);
        record(tally, 'ASIAN_HANDICAP', asian.fullTime.length, book.name);
        record(tally, 'ASIAN_HANDICAP_HT', asian.firstHalf.length, book.name);

        const extended = extractExtendedMarketOdds(match.bookmakers, book.name);
        for (const entry of extended.lineMarkets) {
          record(tally, entry.market, entry.legs.length, book.name);
        }
        for (const entry of extended.fixedMarkets) {
          record(tally, entry.market, entry.legs.length, book.name);
          for (const leg of entry.legs) {
            if (!/^[A-Z_]+$/.test(leg.pick)) unknownPicks.add(leg.pick);
          }
        }
      }
    }

    console.log(
      `${'marché'.padEnd(24)}${'jambes'.padStart(8)}${'books'.padStart(8)}`,
    );
    for (const [market, entry] of [...tally].sort(
      (first, second) => second[1].legs - first[1].legs,
    )) {
      console.log(
        `${market.padEnd(24)}${String(entry.legs).padStart(8)}${String(entry.books.size).padStart(8)}`,
      );
    }
    if (tally.size === 0) {
      console.log('(aucun marché extrait — vérifier la couverture des books)');
    }
    console.log(
      unknownPicks.size === 0
        ? '\nAucun libellé inattendu : tous les picks sont dans le vocabulaire interne.'
        : `\nLibellés inattendus : ${[...unknownPicks].join(', ')}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
