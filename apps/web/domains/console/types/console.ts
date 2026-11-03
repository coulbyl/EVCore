/** Mirror of apps/backend modules/console (GET /console/status, /passes). */
export type LightState = "green" | "orange" | "red";
export type LightKey = "data" | "engine" | "players";

export type TodoItem =
  | { kind: "odds_stale"; light: "data"; severity: "red"; hours: number | null }
  | {
      kind: "etl_failed";
      light: "data";
      severity: "red";
      count: number;
      last: string;
    }
  | { kind: "quota"; light: "data"; severity: "red"; detail: string }
  | {
      kind: "stats_late";
      light: "data";
      severity: "orange";
      fixtures: number;
      competitions: number;
    }
  | {
      kind: "coupons_missing";
      light: "engine";
      severity: "red";
      forDate: string;
    }
  | {
      kind: "analysis_stopped";
      light: "engine";
      severity: "red";
      hours: number | null;
    }
  | {
      kind: "product_absent";
      light: "engine";
      severity: "orange";
      product: string;
      days: number;
      window: number;
    }
  | {
      kind: "market_suspended";
      light: "engine";
      severity: "orange";
      market: string;
      since: string;
    }
  | {
      kind: "ai_silent";
      light: "engine";
      severity: "orange";
      hours: number | null;
    }
  | {
      kind: "players_silent";
      light: "players";
      severity: "red";
      hours: number | null;
    }
  | {
      kind: "channel_alert";
      light: "engine";
      severity: "orange";
      channel: string;
      competition: string;
      ratio: number;
      sample: number;
    }
  | {
      kind: "support_unanswered";
      light: "players";
      severity: "orange";
      count: number;
    };

export type ConsoleStatus = {
  at: string;
  lights: Record<LightKey, LightState>;
  since: Record<LightKey, string | null>;
  todo: TodoItem[];
  yesterday: { active: number; follows: number; signups: number };
  passesOff: { since: string; by: string | null } | null;
};

export type PassKey =
  | "stats"
  | "odds_morning"
  | "morning_brief"
  | "coupons"
  | "odds_evening"
  | "analysis";

export type PassView = {
  key: PassKey;
  at: string;
  state: "done" | "failed" | "running" | "waiting" | "missed";
  lastAt: string | null;
  runningSince: string | null;
  jobs: number;
  failed: number;
  reason: string | null;
  canRelaunch: boolean;
};

export type EngineProduct = {
  product: string;
  retired: boolean;
  launchedOn: string;
  won: number;
  lost: number;
  refunded: number;
  tooEarly: boolean;
  announced: number | null;
  realised: number | null;
  legs: number;
  clv: number | null;
  margin: number | null;
};

export type EngineProducts = {
  period: string;
  products: EngineProduct[];
  ai: {
    won: number;
    lost: number;
    announced: number | null;
    realised: number | null;
    margin: number | null;
    versions: {
      version: string;
      from: string;
      to: string;
      won: number;
      lost: number;
      announced: number | null;
      margin: number | null;
    }[];
  };
};

export type ChannelCell = {
  channel: string;
  competitionCode: string;
  competitionName: string;
  sample: number;
  announced: number | null;
  realised: number | null;
  ratio: number | null;
  low: number | null;
  high: number | null;
  word: "conforme" | "optimistic" | "alert" | "not_enough";
};

export type SuspendedMarket = {
  id: string;
  market: string;
  since: string;
  reason: string;
};

export type PlayersMonth = {
  month: string;
  signups: number;
  activated: number;
  active7: number;
  morning: { sent: number; opened: number };
};

export type PlayerAccount = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "OPERATOR";
  createdAt: string;
  lastSeenAt: string | null;
  follows: number;
  pausedUntil: string | null;
  suspended: boolean;
};

export type PlayerSheet = PlayerAccount & {
  emailVerified: boolean;
  followed: {
    couponId: string;
    forDate: string;
    product: string | null;
    outcome: string | null;
  }[];
  conversationId: string | null;
};

export type AnnouncementView = {
  id: string;
  title: string;
  description: string;
  href: string | null;
  published: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  /** How many players read it. */
  reads: number;
};

/** A Réglages row (12-admin.md § 4); `value` null means « not written ». */
export type SettingView = {
  key:
    | "llm.providers"
    | "research"
    | "apiFootball.quotaAlertPct"
    | "statsBackfill.dailyReserve"
    | "scheduling.enabled";
  value: unknown;
  defaultValue: unknown;
  updatedAt: string | null;
  updatedBy: string | null;
};

/** A line of the human-actions journal. */
export type AdminActionView = {
  id: string;
  at: string;
  actorId: string | null;
  actor: string;
  kind: string;
  target: string;
  before: unknown;
  after: unknown;
  reason: string | null;
};

/** Exploitation › Les files (docs/refonte-ui/exploitation-inventaire.md). */
export type QueueKey =
  | "analysis_soon"
  | "odds"
  | "ai"
  | "settlement"
  | "player_mail"
  | "horizon"
  | "analysis"
  | "season_rollover"
  | "league"
  | "odds_csv"
  | "stale"
  | "elo"
  | "coach"
  | "stats_backfill"
  | "odds_historical"
  | "rebuild"
  | "watch"
  | "push"
  | "odds_archive";

export type QueueView = {
  key: QueueKey;
  state: "failed" | "running" | "on_time" | "paused" | "on_demand";
  lastDoneAt: string | null;
  nextAt: string | null;
  runningSince: string | null;
  failure: { count: number; at: string | null; reason: string | null } | null;
};

export type BackfillView = {
  paused: boolean;
  pausedSince: string | null;
  pausedBy: string | null;
  completedSeasons: number;
  seasons: number;
  pending: number;
  /** Finished fixtures past the stats sync, and those with their events. */
  events: { synced: number; total: number };
  /** Teams playing in the next ten days, and those with a squad this week. */
  squads: { synced: number; total: number };
  quota: { used: number; limit: number } | null;
  reserve: number;
};

export type OddsArchiveView = {
  lastMonth: string | null;
  parquetBytes: number;
  tableBytes: number;
  defaultRows: number;
};

export type QueuesScreen = {
  at: string;
  queues: QueueView[];
  backfill: BackfillView | null;
  oddsArchive: OddsArchiveView | null;
};

export type SettleKind = "coupons" | "selections";

export type SettlePreview = {
  kind: SettleKind;
  from: string;
  to: string;
  items: number;
  followers: number;
  unfinishedDates: number;
  last: AdminActionView | null;
};

export type SettleResult = {
  kind: SettleKind;
  replayed: number;
  corrected: number;
};

/** Réglages › Intégrations: a field, never a secret's value. */
export type IntegrationFieldView = {
  key: string;
  env: string;
  secret: boolean;
  source: "stored" | "env" | "none";
  unreadable: boolean;
  value: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type IntegrationView = {
  key:
    | "apiFootball"
    | "theOddsApi"
    | "email"
    | "push"
    | "storage"
    | "groq"
    | "cerebras"
    | "together"
    | "fireworks"
    | "tavily";
  fields: IntegrationFieldView[];
};

export type IntegrationTestResult = { ok: boolean; detail: string };
