import { describe, expect, it, vi } from 'vitest';
import type { Queue } from 'bullmq';
import type { InvestmentService } from '@modules/investment/investment.service';
import type { ChannelStatsMap } from '@modules/investment/investment-channel-stats.repository';
import type { SubscriptionsRepository } from './subscriptions.repository';
import { SubscriptionsService } from './subscriptions.service';
import { SUBSCRIPTION_SOURCES } from './subscription.constants';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Chemin en dur vers le web, assumé : c'est le seul endroit du monorepo qui
// dispose d'un lanceur de tests, et le couplage est le sujet même du test.
function webSourceLabels(): Record<string, string> {
  const raw = readFileSync(
    join(__dirname, '../../../../web/messages/fr.json'),
    'utf8',
  );
  return (
    JSON.parse(raw) as { subscriptions: { sources: Record<string, string> } }
  ).subscriptions.sources;
}

function channelStats(roiByChannel: Record<string, number>): ChannelStatsMap {
  return Object.fromEntries(
    Object.entries(roiByChannel).map(([channel, roiShrunk]) => [
      channel,
      {
        reliability: { a: 1, b: 0, n: 1000 },
        roiRaw: roiShrunk,
        roiShrunk,
        roiWeight: 0.8,
        hitRate: 0.5,
        n: 1000,
      },
    ]),
  );
}

function makeService(stats: ChannelStatsMap = {}) {
  const repository = {
    findActiveCompetitions: vi.fn().mockResolvedValue([]),
  } as unknown as SubscriptionsRepository;
  const investments = {
    listChannelStats: vi.fn().mockResolvedValue(stats),
  } as unknown as InvestmentService;
  const queue = { add: vi.fn() } as unknown as Queue;
  return new SubscriptionsService(repository, investments, queue);
}

describe('SubscriptionsService.getCatalog', () => {
  it('classe une source canal selon son ROI shrinké mesuré', async () => {
    const service = makeService(
      channelStats({ DOUBLE_CHANCE: 0.0163, BTTS: -0.0639 }),
    );

    const catalog = await service.getCatalog();
    const byId = new Map(catalog.sources.map((s) => [s.id, s]));

    expect(byId.get('CHANNEL_DOUBLE_CHANCE')?.tier).toBe('BACKED');
    expect(byId.get('CHANNEL_BTTS')?.tier).toBe('WATCH');
    expect(byId.get('CHANNEL_BTTS')?.roiShrunk).toBeCloseTo(-0.0639, 6);
    expect(byId.get('CHANNEL_BTTS')?.roiSampleSize).toBe(1000);
  });

  it('bascule un canal en observation dès que sa mesure passe sous zéro', async () => {
    // Le rang est calculé, pas figé : la même source change de groupe si la
    // mesure change, sans qu'aucune liste ne soit à mettre à jour.
    const service = makeService(channelStats({ DOUBLE_CHANCE: -0.001 }));

    const catalog = await service.getCatalog();

    expect(
      catalog.sources.find((s) => s.id === 'CHANNEL_DOUBLE_CHANCE')?.tier,
    ).toBe('WATCH');
  });

  it('laisse une source canal sans mesure en observation', async () => {
    const service = makeService();

    const catalog = await service.getCatalog();
    const draw = catalog.sources.find((s) => s.id === 'CHANNEL_DRAW');

    expect(draw?.tier).toBe('WATCH');
    expect(draw?.roiShrunk).toBeNull();
  });

  it('ne propose pas les sources retirées', async () => {
    const service = makeService();

    const catalog = await service.getCatalog();

    expect(catalog.sources.some((s) => s.id === 'CHANNEL_SAFE')).toBe(false);
    // La source existe toujours dans le catalogue interne — les abonnements
    // qui la ciblent doivent continuer de tourner.
    expect(SUBSCRIPTION_SOURCES.some((s) => s.id === 'CHANNEL_SAFE')).toBe(
      true,
    );
  });

  it('ne met pas de ROI sur une source coupon', async () => {
    const service = makeService(channelStats({ DRAW: 0.01 }));

    const catalog = await service.getCatalog();
    const coupon = catalog.sources.find((s) => s.id === 'COUPON_BEST');

    expect(coupon?.roiShrunk).toBeNull();
    expect(coupon?.roiSampleSize).toBeNull();
  });
});

describe('SubscriptionsService.create', () => {
  it('refuse un nouvel abonnement sur une source retirée', async () => {
    const service = makeService();

    await expect(
      service.create('user-1', {
        sourceType: 'CHANNEL_SAFE',
        channelPickMode: 'INVESTIR',
        topN: 3,
        stakePerEvent: 10,
        daysOfWeek: [1],
        competitionCodes: [],
        startDate: '2026-08-23',
        endDate: '2026-09-23',
      }),
    ).rejects.toThrow(/plus proposée/);
  });
});

/**
 * Le libellé français d'une source existe à DEUX endroits, par nécessité :
 *
 * - `SUBSCRIPTION_SOURCES[].label` (ici) — le backend en a besoin pour
 *   composer les titres de notification, qui ne sont pas localisés.
 * - `apps/web/messages/{fr,en}.json` sous `subscriptions.sources` — le web est
 *   bilingue et ne peut pas se contenter d'une phrase française côté serveur.
 *
 * Rien ne les synchronisait, et ils ont divergé : le backend avait corrigé
 * « Coupon (meilleur du jour) » en « Coupon (le plus probable du jour) » —
 * parce que le rang 1 ne fait pas mieux que les suivants — sans que le web
 * suive. Un abonné lisait donc dans l'app une promesse que le produit avait
 * cessé de faire. Idem pour « chaque coupon généré », borné depuis à la classe
 * à cote courte.
 *
 * Ce test ne supprime pas la duplication (elle est structurelle) : il la rend
 * bruyante. Toute correction d'un côté fait échouer la suite tant que l'autre
 * n'a pas suivi.
 */
describe('libellés de source — backend et web alignés', () => {
  it('a exactement les mêmes clés des deux côtés', () => {
    const webKeys = Object.keys(webSourceLabels()).sort();
    const backendKeys = SUBSCRIPTION_SOURCES.map((s) => s.id).sort();
    expect(webKeys).toEqual(backendKeys);
  });

  it('utilise le même texte français pour chaque source', () => {
    const web = webSourceLabels();
    for (const source of SUBSCRIPTION_SOURCES) {
      expect(
        web[source.id],
        `Libellé désynchronisé pour ${source.id} — backend et apps/web/messages/fr.json doivent dire la même chose`,
      ).toBe(source.label);
    }
  });
});
