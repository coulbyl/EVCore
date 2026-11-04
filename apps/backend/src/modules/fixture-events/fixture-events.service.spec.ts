import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FixtureByIdDetailsSchema } from '../etl/schemas/fixture-full.schema';
import { fixturesByIdsSample } from '../etl/schemas/fixture-full.sample';
import { FIXTURE_EVENTS } from '@config/etl.constants';
import { FixtureEventsService, isSynced } from './fixture-events.service';
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
      label: 'Chelsea – Manchester United',
      teams: new Map([
        [49, 'chelsea-id'],
        [33, 'united-id'],
      ]),
    });
    events.transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) => fn(TX),
    );
  });

  it('writes the whistle answer without marking the match synced', async () => {
    // Complete, but two hours after kick-off: the API still corrects it.
    const result = await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-25T16:00:00Z'),
      details: details(),
    });

    expect(result).toMatchObject({ status: 'written', synced: false });
    expect(events.replaceForFixture).toHaveBeenCalled();
    expect(events.markSynced).not.toHaveBeenCalled();
  });

  it('replaces the three blocks in one transaction and marks a complete match', async () => {
    const observedAt = new Date('2026-10-25T18:00:00Z');
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

  it('a block sent empty keeps the one already written', async () => {
    await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-29T14:00:00Z'),
      details: details((entry) => {
        entry.lineups = [];
      }),
    });
    expect(events.replaceForFixture).toHaveBeenCalled();
    expect(playerStatistics.replaceForFixture).toHaveBeenCalled();
    expect(lineups.replaceForFixture).not.toHaveBeenCalled();
    expect(events.markSynced).toHaveBeenCalled();
  });

  it('rejects a match naming a team that is neither side, writing nothing', async () => {
    events.findFixtureIdentity.mockResolvedValue({
      fixtureId: 'fixture-1',
      scheduledAt: KICKOFF,
      label: 'Chelsea – Manchester United',
      teams: new Map([[49, 'chelsea-id']]),
    });
    const result = await service.persistDetails({
      fixtureExternalId: 1557450,
      observedAt: new Date('2026-10-25T17:00:00Z'),
      details: details(),
    });
    expect(result).toMatchObject({
      status: 'rejected',
      cause: 'unknown-team',
      match: 'Chelsea – Manchester United',
    });
    expect(players.upsertMany).not.toHaveBeenCalled();
    expect(events.transaction).not.toHaveBeenCalled();
  });
});

describe('FixtureEventsService.writeEntry', () => {
  const events = {
    findFixtureIdentity: vi.fn(),
    transaction: vi.fn(),
    replaceForFixture: vi.fn(),
    markSynced: vi.fn(),
  } satisfies Partial<FixtureEventRepository>;
  const players = { upsertMany: vi.fn() } satisfies Partial<PlayerRepository>;
  const service = new FixtureEventsService(
    events as unknown as FixtureEventRepository,
    { replaceForFixture: vi.fn() } as unknown as FixtureLineupRepository,
    {
      replaceForFixture: vi.fn(),
    } as unknown as FixturePlayerStatisticRepository,
    players as unknown as PlayerRepository,
  );
  const observedAt = new Date('2026-10-25T18:00:00Z');
  const rawEntry = () => fixturesByIdsSample().response[0];

  beforeEach(() => {
    vi.clearAllMocks();
    events.findFixtureIdentity.mockResolvedValue({
      fixtureId: 'fixture-1',
      scheduledAt: KICKOFF,
      label: 'Chelsea – Manchester United',
      teams: new Map([
        [49, 'chelsea-id'],
        [33, 'united-id'],
      ]),
    });
    events.transaction.mockImplementation(
      (fn: (tx: unknown) => Promise<unknown>) => fn(TX),
    );
  });

  it('validates and writes a raw entry', async () => {
    const result = await service.writeEntry({
      fixtureExternalId: 1557450,
      observedAt,
      entry: rawEntry(),
    });
    expect(result).toMatchObject({
      status: 'written',
      synced: true,
      dropped: { events: 0, lineups: 0, players: 0 },
    });
  });

  it('says a block is missing, writing nothing', async () => {
    const entry = { ...(rawEntry() as Record<string, unknown>) };
    delete entry.players;
    const result = await service.writeEntry({
      fixtureExternalId: 1557450,
      observedAt,
      entry,
    });
    expect(result).toMatchObject({
      status: 'rejected',
      cause: 'missing-block',
      reason: 'players',
    });
    expect(events.findFixtureIdentity).not.toHaveBeenCalled();
  });

  it('says the fixture is unknown', async () => {
    events.findFixtureIdentity.mockResolvedValue(null);
    await expect(
      service.writeEntry({
        fixtureExternalId: 1,
        observedAt,
        entry: rawEntry(),
      }),
    ).resolves.toMatchObject({ status: 'rejected', cause: 'unknown-fixture' });
  });

  it('says a write failed, naming the match, and never throws', async () => {
    events.transaction.mockRejectedValue(new Error('deadlock'));
    await expect(
      service.writeEntry({
        fixtureExternalId: 1557450,
        observedAt,
        entry: rawEntry(),
      }),
    ).resolves.toEqual({
      status: 'rejected',
      cause: 'write-failed',
      reason: 'deadlock',
      match: 'Chelsea – Manchester United',
    });
  });
});

describe('isSynced, the one rule', () => {
  const at = (hours: number) => new Date(KICKOFF.getTime() + hours * 3_600_000);

  it('waits FINAL_AFTER_HOURS after kick-off for a complete answer', () => {
    expect(
      isSynced({ complete: true, kickoff: KICKOFF, observedAt: at(2) }),
    ).toBe(false);
    expect(
      isSynced({
        complete: true,
        kickoff: KICKOFF,
        observedAt: at(FIXTURE_EVENTS.FINAL_AFTER_HOURS),
      }),
    ).toBe(true);
  });

  it('takes an incomplete answer as final past the grace period', () => {
    expect(
      isSynced({ complete: false, kickoff: KICKOFF, observedAt: at(24) }),
    ).toBe(false);
    expect(
      isSynced({
        complete: false,
        kickoff: KICKOFF,
        observedAt: at(FIXTURE_EVENTS.INCOMPLETE_GRACE_DAYS * 24),
      }),
    ).toBe(true);
  });
});
