import type {
  NormalizedFixtureStatistic,
  RawFixtureStatistic,
} from './fixture-statistics.types';

const STATISTIC_TYPE_ALIASES: Readonly<Record<string, string>> = {
  'shots on goal': 'shots_on_goal',
  'shots off goal': 'shots_off_goal',
  'total shots': 'total_shots',
  'blocked shots': 'blocked_shots',
  'shots insidebox': 'shots_inside_box',
  'shots outsidebox': 'shots_outside_box',
  fouls: 'fouls',
  'corner kicks': 'corner_kicks',
  offsides: 'offsides',
  'ball possession': 'ball_possession',
  'yellow cards': 'yellow_cards',
  'red cards': 'red_cards',
  'goalkeeper saves': 'goalkeeper_saves',
  'total passes': 'total_passes',
  'passes accurate': 'passes_accurate',
  'passes %': 'passes_percentage',
  expected_goals: 'expected_goals',
  goals_prevented: 'goals_prevented',
};

export function normalizeStatisticType(type: string): string {
  const key = type.trim().toLowerCase();
  return (
    STATISTIC_TYPE_ALIASES[key] ??
    key
      .replace(/%/g, ' percentage ')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
  );
}

export function parseStatisticValue(
  value: RawFixtureStatistic['value'],
): number | null {
  if (value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const parsed = Number(value.trim().replace(/%$/, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeTeamStatistics(input: {
  teamId: string;
  statistics: readonly RawFixtureStatistic[];
}): NormalizedFixtureStatistic[] {
  const normalized = new Map<string, NormalizedFixtureStatistic>();
  for (const statistic of input.statistics) {
    const value = parseStatisticValue(statistic.value);
    const type = normalizeStatisticType(statistic.type);
    if (value === null || type.length === 0) continue;
    normalized.set(type, {
      teamId: input.teamId,
      type,
      value,
      rawValue: String(statistic.value),
    });
  }
  return [...normalized.values()];
}
