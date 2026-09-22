export type RawFixtureStatistic = {
  type: string;
  value: number | string | null;
};

export type RawTeamFixtureStatistics = {
  externalTeamId: number;
  statistics: readonly RawFixtureStatistic[];
};

export type NormalizedFixtureStatistic = {
  teamId: string;
  type: string;
  value: number;
  rawValue: string;
};

export type PersistFixtureStatisticsInput = {
  fixtureExternalId: number;
  observedAt: Date;
  teams: readonly RawTeamFixtureStatistics[];
};
