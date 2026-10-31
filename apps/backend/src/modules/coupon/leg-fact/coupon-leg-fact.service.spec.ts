import { describe, expect, it, vi } from 'vitest';
import { CouponLegFactService } from './coupon-leg-fact.service';
import type {
  LegFactRepository,
  LegWithoutFact,
  TeamMatchRow,
} from './leg-fact.repository';

const NOW = new Date('2026-10-29T17:00:00.000Z');

function leg(overrides: Partial<LegWithoutFact>): LegWithoutFact {
  return {
    legId: 'leg-1',
    market: 'ONE_X_TWO',
    pick: 'HOME',
    line: null,
    homeTeamId: 'psg',
    homeName: 'PSG',
    homeShortName: 'PSG',
    awayTeamId: 'lens',
    awayName: 'Lens',
    awayShortName: 'LEN',
    ...overrides,
  };
}

const win = (teamId: string): TeamMatchRow => ({
  teamId,
  atHome: true,
  scheduledAt: new Date('2026-10-20T19:00:00.000Z'),
  goalsFor: 2,
  goalsAgainst: 0,
  halfTimeFor: 1,
  halfTimeAgainst: 0,
  corners: null,
});

function harness(legs: LegWithoutFact[], rows: TeamMatchRow[] = []) {
  const repository = {
    findLegsWithoutFact: vi.fn().mockResolvedValue(legs),
    findTeamHistories: vi.fn().mockResolvedValue(rows),
    saveFacts: vi.fn().mockResolvedValue(legs.length),
  } as unknown as LegFactRepository;
  return { service: new CouponLegFactService(repository), repository };
}

describe('CouponLegFactService', () => {
  it('reads nothing more when every leg already has its fact', async () => {
    const { service, repository } = harness([]);
    expect(await service.fillForDate(NOW, NOW)).toEqual({
      legs: 0,
      withFact: 0,
    });
    expect(repository.findTeamHistories).not.toHaveBeenCalled();
    expect(repository.saveFacts).not.toHaveBeenCalled();
  });

  it('reads each team once, over the year before generation', async () => {
    const { service, repository } = harness([
      leg({ legId: 'a' }),
      leg({ legId: 'b', homeTeamId: 'lens', awayTeamId: 'psg' }),
    ]);
    await service.fillForDate(NOW, NOW);
    expect(repository.findTeamHistories).toHaveBeenCalledWith({
      teamIds: ['psg', 'lens'],
      since: new Date('2025-10-29T17:00:00.000Z'),
      before: NOW,
      perVenue: 10,
    });
  });

  it('writes a fact per leg, an empty one when nothing is solid', async () => {
    const { service, repository } = harness(
      [
        leg({ legId: 'psg-wins' }),
        leg({ legId: 'nothing', market: 'CORRECT_SCORE', pick: '1:1' }),
      ],
      Array.from({ length: 6 }, () => win('psg')),
    );
    expect(await service.fillForDate(NOW, NOW)).toEqual({
      legs: 2,
      withFact: 1,
    });
    expect(repository.saveFacts).toHaveBeenCalledWith([
      {
        legId: 'psg-wins',
        fact: 'PSG a gagné ses 6 derniers matchs à domicile',
      },
      { legId: 'nothing', fact: '' },
    ]);
  });
});
