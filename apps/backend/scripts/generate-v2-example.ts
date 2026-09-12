/**
 * Génère un exemple de fiche v2 sur quelques matchs réels, écrit dans
 * `docs/examples/`. Sert de référence de contrat pour les consommateurs de la
 * fiche et de vérification de bout en bout sur des données de production.
 *
 * Usage : pnpm --filter backend exec tsx scripts/generate-v2-example.ts [from] [to] [limit]
 *
 * À lancer depuis apps/backend (ce que fait `pnpm --filter backend exec`).
 */
import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { prisma as prismaClient } from '@evcore/db';
import { AnalysisSheetRepository } from '../src/modules/analysis-sheet/analysis-sheet.repository';
import { AnalysisSheetV2Repository } from '../src/modules/analysis-sheet/analysis-sheet-v2.repository';
import { AnalysisSheetV2Service } from '../src/modules/analysis-sheet/analysis-sheet-v2.service';
import { AnalysisSheetService } from '../src/modules/analysis-sheet/analysis-sheet.service';
import type { PrismaService } from '../src/prisma.service';

async function main(): Promise<void> {
  const [from = '2026-09-11', to = '2026-09-13', limitArg = '3'] =
    process.argv.slice(2);
  const limit = Number(limitArg);

  const prisma = { client: prismaClient } as unknown as PrismaService;

  const v2Repository = new AnalysisSheetV2Repository(prisma);
  const service = new AnalysisSheetService(
    new AnalysisSheetRepository(prisma),
    new AnalysisSheetV2Service(v2Repository),
  );

  const sheet = await service.exportJsonV2({
    from,
    to,
    filters: { statuses: ['SCHEDULED'], markets: null, excludeChannels: null },
    compact: true,
  });

  // On ne garde que les premiers matchs : l'exemple doit rester lisible.
  const trimmed = {
    ...sheet,
    summary: { ...sheet.summary, fixtureCount: Math.min(limit, sheet.fixtures.length) },
    fixtures: sheet.fixtures.slice(0, limit),
    legPool: sheet.legPool
      ? {
          ...sheet.legPool,
          entries: sheet.legPool.entries.filter((entry) =>
            sheet.fixtures.slice(0, limit).some((f) => f.fixtureId === entry.fixtureId),
          ),
        }
      : null,
    calibration: sheet.calibration
      ? {
          ...sheet.calibration,
          // L'agrégat complet pèse des centaines de lignes : on montre la forme.
          byMarketAndCompetition: sheet.calibration.byMarketAndCompetition.slice(0, 5),
          lambdaBiasByCompetition: sheet.calibration.lambdaBiasByCompetition.slice(0, 5),
        }
      : null,
  };

  const cwd = process.cwd();
  if (basename(cwd) !== 'backend') {
    throw new Error(
      `Lancer ce script depuis apps/backend (cwd actuel : ${cwd}). ` +
        'Utiliser `pnpm --filter backend exec tsx scripts/generate-v2-example.ts`.',
    );
  }
  const target = join(
    cwd,
    '../../docs/examples/analysis-sheet-v2-example.json',
  );
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(trimmed, null, 2)}\n`);

  process.stdout.write(
    `Fiche v2 écrite : ${target}\n` +
      `Matchs exportés : ${trimmed.fixtures.length} / ${sheet.fixtures.length}\n` +
      `legPool : ${trimmed.legPool?.entries.length ?? 0} sélections\n`,
  );

  await prismaClient.$disconnect();
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
