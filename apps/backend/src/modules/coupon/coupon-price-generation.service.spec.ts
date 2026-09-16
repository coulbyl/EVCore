import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CouponPriceGenerationService } from './coupon-price-generation.service';
import type {
  CouponRepository,
  MarketCostCell,
  PriceCandidateRow,
} from './coupon.repository';

const FOR_DATE = new Date('2026-09-16T00:00:00.000Z');

function cell(overrides: Partial<MarketCostCell> = {}): MarketCostCell {
  return {
    market: 'OVER_UNDER',
    band: '1.3-1.45',
    legCount: 5_000,
    meanPayout: 0.96,
    // Variance faible : la borne basse reste proche de la moyenne, ce qui rend
    // les attentes du test lisibles.
    payoutVariance: 0.01,
    ...overrides,
  };
}

function row(overrides: Partial<PriceCandidateRow> = {}): PriceCandidateRow {
  return {
    fixtureId: 'f-1',
    competition: 'L1',
    market: 'OVER_UNDER',
    pick: 'OVER',
    odds: 1.4,
    band: '1.3-1.45',
    scheduledAt: new Date('2026-09-16T18:00:00.000Z'),
    ...overrides,
  };
}

function makeRepository() {
  return {
    findMarketCostCalibration:
      vi.fn<CouponRepository['findMarketCostCalibration']>(),
    findPriceCandidates: vi.fn<CouponRepository['findPriceCandidates']>(),
    upsertPriceComposerProposal: vi
      .fn<CouponRepository['upsertPriceComposerProposal']>()
      .mockResolvedValue('proposal-1'),
    recordPriceComposerAttempt: vi
      .fn<CouponRepository['recordPriceComposerAttempt']>()
      .mockResolvedValue(undefined),
  };
}

describe('CouponPriceGenerationService', () => {
  let repository: ReturnType<typeof makeRepository>;
  let service: CouponPriceGenerationService;

  beforeEach(() => {
    repository = makeRepository();
    service = new CouponPriceGenerationService(
      repository as unknown as CouponRepository,
    );
  });

  it('calibre sur l’historique antérieur au jour composé', async () => {
    repository.findMarketCostCalibration.mockResolvedValue([]);
    repository.findPriceCandidates.mockResolvedValue([]);

    await service.generateForDate(new Date('2026-09-16T14:30:00.000Z'));

    // Inclure la journée qu'on compose reviendrait à lire son propre résultat.
    expect(repository.findMarketCostCalibration).toHaveBeenCalledWith(FOR_DATE);
  });

  it('s’abstient et l’enregistre quand aucune jambe n’est prixée', async () => {
    repository.findMarketCostCalibration.mockResolvedValue([]);
    repository.findPriceCandidates.mockResolvedValue([row()]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toEqual({
      outcome: 'abstained',
      reason: 'no_priced_candidate',
      candidateCount: 1,
    });
    expect(repository.upsertPriceComposerProposal).not.toHaveBeenCalled();
    // Une abstention doit rester distinguable d'un worker tombé.
    expect(repository.recordPriceComposerAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'abstained',
        reason: 'no_priced_candidate',
      }),
    );
  });

  it('écarte un marché trop peu mesuré au lieu de deviner son coût', async () => {
    repository.findMarketCostCalibration.mockResolvedValue([
      cell({ market: 'CORRECT_SCORE', legCount: 100 }),
    ]);
    repository.findPriceCandidates.mockResolvedValue([
      row({ market: 'CORRECT_SCORE' }),
    ]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result.outcome).toBe('abstained');
  });

  it('s’abstient quand la cible de cote est hors d’atteinte', async () => {
    repository.findMarketCostCalibration.mockResolvedValue([cell()]);
    // Deux jambes à 1,40 plafonnent à 1,96 : la cote 5 est inatteignable.
    repository.findPriceCandidates.mockResolvedValue([
      row({ fixtureId: 'f-1' }),
      row({ fixtureId: 'f-2', competition: 'PL' }),
    ]);

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toMatchObject({
      outcome: 'abstained',
      reason: 'target_unreachable',
    });
  });

  it('compose et persiste quand la cible est atteignable', async () => {
    repository.findMarketCostCalibration.mockResolvedValue([
      cell({ band: '1.6-1.8', meanPayout: 0.95 }),
    ]);
    repository.findPriceCandidates.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) =>
        row({
          fixtureId: `f-${index}`,
          competition: `C${index}`,
          odds: 1.75,
          band: '1.6-1.8',
        }),
      ),
    );

    const result = await service.generateForDate(FOR_DATE);

    expect(result).toMatchObject({
      outcome: 'composed',
      proposalId: 'proposal-1',
    });
    const [persisted] =
      repository.upsertPriceComposerProposal.mock.calls[0] ?? [];
    expect(persisted?.combinedOdds).toBeGreaterThanOrEqual(5);
    expect(persisted?.combinedOdds).toBeLessThanOrEqual(15);
    // Le coup d'envoi retenu est le plus tardif : c'est lui qui clôt le coupon.
    expect(persisted?.lastFixtureScheduledAt).toEqual(
      new Date('2026-09-16T18:00:00.000Z'),
    );
  });

  // Le garde-fou central : aucun marché n'est positif, donc créditer une
  // cellule au-dessus de 1 ne peut être qu'un accident de fenêtre.
  it('ne crédite jamais une jambe au-dessus de 1, même si la mesure le dit', async () => {
    repository.findMarketCostCalibration.mockResolvedValue([
      cell({ band: '1.6-1.8', meanPayout: 1.4, payoutVariance: 0.0001 }),
    ]);
    repository.findPriceCandidates.mockResolvedValue(
      Array.from({ length: 5 }, (_, index) =>
        row({
          fixtureId: `f-${index}`,
          competition: `C${index}`,
          odds: 1.75,
          band: '1.6-1.8',
        }),
      ),
    );

    await service.generateForDate(FOR_DATE);

    const [persisted] =
      repository.upsertPriceComposerProposal.mock.calls[0] ?? [];
    expect(persisted?.expectedReturn).toBeLessThanOrEqual(1);
    for (const leg of persisted?.legs ?? []) {
      expect(leg.expectedReturn).toBeLessThanOrEqual(1);
    }
  });
});
