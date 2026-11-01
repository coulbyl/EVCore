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
  | "ai_combo"
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
  published: boolean;
  publishedAt: string | null;
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
