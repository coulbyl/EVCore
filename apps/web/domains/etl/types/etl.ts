export type QueueJobCounts = {
  active: number;
  waiting: number;
  completed: number;
  failed: number;
  delayed: number;
};

export type EtlQueueStatus = Record<string, QueueJobCounts>;

export type EtlSyncResult = { status: "ok" };

export type EtlLeagueSyncResult = {
  status: "ok";
  competitionCode: string;
};

export type EtlBackfillResult = {
  status: "ok";
  competitionCode: string;
  seasons: number[];
};

export type EtlOddsHistoricalFullResult = {
  status: "ok";
  competitionCodes: string[];
  seasons: number[];
};

export type EtlRebuildResult = {
  status: "ok";
  queued: number;
  seasonIds: string[];
};

export type EtlRollingStatsResult = {
  status: "ok";
  competitionCode: string;
  season: number;
  mode: "refresh" | "rebuild";
};

export type EtlHorizonResult = {
  status: "ok";
  enqueuedDates: string[];
};

export type EtlSchedulerEntry = {
  queueName: string;
  key: string;
  name: string;
  pattern?: string;
  every?: number;
  next?: number;
};

export type EtlClearQueueResult = {
  status: "ok";
  removed: number;
};

export type GlobalSyncType =
  | "fixtures"
  | "stats"
  | "injuries"
  | "settlement"
  | "stale-scheduled"
  | "odds-csv"
  | "elo"
  | "coach"
  | "odds-prematch"
  | "analysis"
  | "season-rollover";

export type LeagueSyncType = "fixtures" | "stats" | "injuries";

export type StatsBackfillSeason = {
  competitionCode: string;
  seasonName: string;
  wave: number;
  pending: number;
  synced: number;
  unavailable: number;
};

export type StatsBackfillStatus = {
  scheduled: boolean;
  paused: boolean;
  reserve: number;
  quota: { current: number; limitDay: number; budget: number } | null;
  totals: {
    seasons: number;
    completedSeasons: number;
    pending: number;
    synced: number;
    unavailable: number;
  };
  next: StatsBackfillSeason[];
  parked: StatsBackfillSeason[];
};

export type StatsBackfillAction = "pause" | "resume" | "run";
