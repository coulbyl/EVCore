import { z } from 'zod';
import { repairProviderText } from '@evcore/analysis-core';
import type { SquadPlayerRow } from '@modules/fixture-events/player-squad.repository';

// /players/squads?team=<id> (one call per team). The API writes id 0 for a
// player it does not know and leaves number, age and photo null at will.
const SquadPlayerSchema = z.object({
  id: z.number().int().nonnegative(),
  name: z.string().nullable(),
  number: z.number().int().nullable().optional(),
  position: z.string().nullable().optional(),
  photo: z.string().nullable().optional(),
});

export const ApiFootballSquadsResponseSchema = z.object({
  response: z.array(
    z.object({
      team: z.object({ id: z.number().int().positive() }),
      players: z.array(SquadPlayerSchema),
    }),
  ),
});

export type ApiFootballSquadsResponse = z.infer<
  typeof ApiFootballSquadsResponseSchema
>;

/**
 * The players of one team's answer, cleaned: id 0 and nameless rows left
 * out (nothing could identify them), the provider's text faults repaired
 * (HTML entities, UTF-8 read as Latin-1), a repeated id kept once. An
 * answer about another team is no answer.
 */
export function squadPlayersOf(
  body: ApiFootballSquadsResponse,
  teamExternalId: number,
): SquadPlayerRow[] {
  const rows = new Map<number, SquadPlayerRow>();
  for (const entry of body.response) {
    if (entry.team.id !== teamExternalId) continue;
    for (const player of entry.players) {
      const name =
        player.name === null ? '' : repairProviderText(player.name).trim();
      if (player.id === 0 || name.length === 0) continue;
      if (rows.has(player.id)) continue;
      rows.set(player.id, {
        playerExternalId: player.id,
        name,
        number: player.number ?? null,
        position: player.position ?? null,
        photoUrl: player.photo ?? null,
      });
    }
  }
  return [...rows.values()];
}
