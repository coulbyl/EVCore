import { describe, expect, it, vi } from 'vitest';
import { fetchLeagueSeasonDates } from './league-season-dates';
import type { ApiFootballClient } from './api-football.client';

function buildClient(body: unknown, status = 200) {
  return {
    fetchJson: vi.fn().mockResolvedValue({ response: { status, body } }),
  } as unknown as ApiFootballClient;
}

const j1Body = {
  get: 'leagues',
  parameters: { id: '98' },
  results: 1,
  response: [
    {
      league: { id: 98, name: 'J1 League' },
      seasons: [
        { year: 2026, start: '2026-02-01', end: '2026-12-31', current: false },
        { year: 2027, start: '2026-08-07', end: '2027-06-06', current: true },
      ],
    },
  ],
};

describe('fetchLeagueSeasonDates', () => {
  it("returns the matching season year's real start/end dates", async () => {
    const client = buildClient(j1Body);
    const dates = await fetchLeagueSeasonDates(client, '98', 2027);
    expect(dates).toEqual({
      startDate: new Date('2026-08-07T00:00:00Z'),
      endDate: new Date('2027-06-06T00:00:00Z'),
    });
  });

  it('returns null when no season in the response matches the requested year', async () => {
    const client = buildClient(j1Body);
    expect(await fetchLeagueSeasonDates(client, '98', 2099)).toBeNull();
  });

  it('returns null on HTTP error, Zod failure, or empty response', async () => {
    expect(
      await fetchLeagueSeasonDates(buildClient({}, 500), '98', 2027),
    ).toBeNull();
    expect(
      await fetchLeagueSeasonDates(
        buildClient({ response: [{ bad: true }] }),
        '98',
        2027,
      ),
    ).toBeNull();
    expect(
      await fetchLeagueSeasonDates(buildClient({ response: [] }), '98', 2027),
    ).toBeNull();
  });

  it('returns null when the client throws (never blocks a fixtures sync)', async () => {
    const client = {
      fetchJson: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as ApiFootballClient;
    expect(await fetchLeagueSeasonDates(client, '98', 2027)).toBeNull();
  });
});
