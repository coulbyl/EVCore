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

export type EtlStandingsResult = {
  status: "ok";
  competitionCode: string;
  season: number;
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
  | "odds-prematch"
  | "analysis"
  | "standings";

export type LeagueSyncType = "fixtures" | "stats" | "injuries";
