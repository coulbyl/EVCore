import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FixtureByIdDetailsSchema } from '../etl/schemas/fixture-full.schema';
import { fixturesByIdsSample } from '../etl/schemas/fixture-full.sample';
import { FixtureEventsService } from './fixture-events.service';
import type { FixtureEventRepository } from './fixture-event.repository';
import type { FixtureLineupRepository } from './fixture-lineup.repository';
import type { FixturePlayerStatisticRepository } from './fixture-player-statistic.repository';
import type { PlayerRepository } from './player.repository';

const KICKOFF = new Date('2026-10-25T14:00:00Z');
const TX = { tx: true };

function details(mutate?: (entry: Record<string, unknown>) => void) {
  const entry = fixturesByIdsSample().response[0] as Record<string, unknown>;
  mutate?.(entry);
  return FixtureByIdDetailsSchema.parse(entry);
}

describe('FixtureEventsService.persistDetails', () => {
  const events = {
    findFixtureIdentity: vi.fn(),
    transaction: vi.fn(),
    replaceForFixture: vi.fn(),
    markSynced: vi.fn(),
  } satisfies Partial<FixtureEventRepository>;
  const lineups = {
    replaceForFixture: vi.fn(),
  } satisfies Partial<FixtureLineupRepository>;
  const playerStatistics = {
    replaceForFixture: vi.fn(),
  } satisfies Partial<FixturePlayerStatisticRepository>;
  const players = { upsertMany: vi.fn() } satisfies Partial<PlayerRepository>;
  const service = new FixtureEventsService(
    events as unknown as FixtureEventRepository,
    lineups as unknown as FixtureLineupRepository,
    playerStatistics as unknown as FixturePlayerStatisticRepository,
    players as unknown as PlayerRepository,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    events.findFixtureIdentity.mockResolvedValue({
      fixtureId: 'fixture-1',
      scheduledAt: KICKOFF,
      teams: new Map([
        [49, 'chelsea-id'],
        [33, 'united-id'],
      ]),
    });
    events.transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) => fn(TX),
    );
  });

  it('replaces the three blocks in one transaction and marks a complete match', async () => {
    const observedAt = new Date('2026-10-25T17:00:00Z');
    const result = await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt,
      details: details(),
    });

    expect(result).toMatchObject({ status: 'written', synced: true });
    for (const repository of [events, lineups, playerStatistics]) {
      expect(repository.replaceForFixture).toHaveBeenCalledWith(
        expect.objectContaining({ tx: TX, fixtureId: 'fixture-1', observedAt }),
      );
    }
    expect(events.markSynced).toHaveBeenCalledWith({
      tx: TX,
      fixtureId: 'fixture-1',
      observedAt,
    });
    expect(players.upsertMany).toHaveBeenCalledOnce();
  });

  it('writes the same rows on a re-sync', async () => {
    const input = {
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-25T17:00:00Z'),
      details: details(),
    };
    await service.persistDetails(input);
    await service.persistDetails(input);
    const [first, second] = events.replaceForFixture.mock.calls;
    expect(second).toEqual(first);
  });

  it('writes a recent incomplete match but leaves it for a later pass', async () => {
    const result = await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-25T17:00:00Z'),
      details: details((entry) => {
        entry.players = [];
      }),
    });

    expect(result).toMatchObject({ status: 'written', synced: false });
    expect(events.replaceForFixture).toHaveBeenCalled();
    expect(events.markSynced).not.toHaveBeenCalled();
  });

  it('marks an incomplete match once the grace period is over', async () => {
    const result = await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-29T14:00:00Z'),
      details: details((entry) => {
        entry.players = [];
      }),
    });
    expect(result).toMatchObject({ synced: true });
    expect(events.markSynced).toHaveBeenCalled();
  });

  it('never erases written rows with an empty answer', async () => {
    await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-25T17:00:00Z'),
      details: details((entry) => {
        entry.events = [];
        entry.lineups = [];
        entry.players = [];
      }),
    });
    expect(events.replaceForFixture).not.toHaveBeenCalled();
    expect(lineups.replaceForFixture).not.toHaveBeenCalled();
    expect(playerStatistics.replaceForFixture).not.toHaveBeenCalled();
    expect(events.markSynced).not.toHaveBeenCalled();
  });

  it('rejects a match naming a team that is neither side, writing nothing', async () => {
    events.findFixtureIdentity.mockResolvedValue({
      fixtureId: 'fixture-1',
      scheduledAt: KICKOFF,
      teams: new Map([[49, 'chelsea-id']]),
    });
    const result = await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-25T17:00:00Z'),
      details: details(),
    });
    expect(result.status).toBe('rejected');
    expect(players.upsertMany).not.toHaveBeenCalled();
    expect(events.transaction).not.toHaveBeenCalled();
  });
});
