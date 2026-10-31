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
