import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlayerSquadRepository } from '@modules/fixture-events/player-squad.repository';
import type { ApiFootballClient } from './api-football.client';
import { SquadsSyncService } from './squads-sync.service';

vi.mock('@utils/async.utils', () => ({ sleep: vi.fn() }));

const answer = (teamExternalId: number) => ({
  response: {
    status: 200,
    body: {
      errors: [],
      response: [
        {
          team: { id: teamExternalId },
          players: [
            {
              id: 1100,
              name: 'E. Haaland',
              number: 9,
              position: 'Attacker',
              photo: null,
            },
          ],
        },
      ],
    },
  },
});

describe('SquadsSyncService', () => {
  const squads = {
    findTeamsDue: vi.fn(),
    replaceSquad: vi.fn(),
  };
  const apiFootball = { fetchJson: vi.fn() };
  const service = () =>
    new SquadsSyncService(
      apiFootball as unknown as ApiFootballClient,
      squads as unknown as PlayerSquadRepository,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    squads.replaceSquad.mockResolvedValue(undefined);
  });

  it('asks for the teams due in the next ten days, a week stale, within the budget', async () => {
    squads.findTeamsDue.mockResolvedValue([]);
    const now = new Date('2026-11-03T12:00:00Z');

    const result = await service().syncDue(12, now);

    expect(result.status).toBe('nothing-left');
    expect(squads.findTeamsDue).toHaveBeenCalledWith({
      from: now,
      to: new Date('2026-11-13T12:00:00Z'),
      staleBefore: new Date('2026-10-27T12:00:00Z'),
      limit: 12,
      excludeExternalIds: [],
    });
    expect(apiFootball.fetchJson).not.toHaveBeenCalled();
  });

  it('writes one call per team', async () => {
    squads.findTeamsDue.mockResolvedValue([
      { teamId: 't50', externalId: 50 },
      { teamId: 't33', externalId: 33 },
    ]);
    apiFootball.fetchJson
      .mockResolvedValueOnce(answer(50))
      .mockResolvedValueOnce(answer(33));

    const result = await service().syncDue(40);

    expect(apiFootball.fetchJson.mock.calls[0]?.[0]).toMatch(
      /\/players\/squads\?team=50$/,
    );
    expect(squads.replaceSquad).toHaveBeenCalledTimes(2);
    expect(squads.replaceSquad.mock.calls[0]?.[0]).toMatchObject({
      teamId: 't50',
      players: [{ playerExternalId: 1100, name: 'E. Haaland' }],
    });
    expect(result).toEqual({
      status: 'lot-done',
      teams: 2,
      written: 2,
      players: 2,
      calls: 2,
    });
  });

  it('stops on a quota answer and writes nothing for it', async () => {
    squads.findTeamsDue.mockResolvedValue([
      { teamId: 't50', externalId: 50 },
      { teamId: 't33', externalId: 33 },
    ]);
    apiFootball.fetchJson.mockResolvedValue({
      response: {
        status: 200,
        body: { errors: { requests: 'limit reached' }, response: [] },
      },
    });

    const result = await service().syncDue(40);

    expect(result).toMatchObject({ status: 'lot-aborted', calls: 1 });
    expect(squads.replaceSquad).not.toHaveBeenCalled();
  });

  it('leaves a team that keeps failing after three attempts', async () => {
    squads.findTeamsDue.mockResolvedValue([{ teamId: 't9', externalId: 9 }]);
    apiFootball.fetchJson.mockResolvedValue({
      response: { status: 200, body: { response: [{ team: {} }] } },
    });
    const sync = service();

    for (let tick = 0; tick < 4; tick++) await sync.syncDue(40);

    expect(squads.replaceSquad).not.toHaveBeenCalled();
    expect(squads.findTeamsDue.mock.calls[2]?.[0].excludeExternalIds).toEqual(
      [],
    );
    expect(squads.findTeamsDue.mock.calls[3]?.[0].excludeExternalIds).toEqual([
      9,
    ]);
  });
});
