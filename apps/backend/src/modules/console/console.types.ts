/** A light of the admin's home (12 § 1): green, orange or red. */
export type LightState = 'green' | 'orange' | 'red';

export type LightKey = 'data' | 'engine' | 'players';

/**
 * A line of « À faire »: what the system found, with its figures. The web
 * writes the sentence (`console.todo.<kind>`) and links where to act.
 */
export type TodoItem =
  | { kind: 'odds_stale'; light: 'data'; severity: 'red'; hours: number | null }
  | {
      kind: 'etl_failed';
      light: 'data';
      severity: 'red';
      count: number;
      last: string;
    }
  | { kind: 'quota'; light: 'data'; severity: 'red'; detail: string }
  | {
      kind: 'stats_late';
      light: 'data';
      severity: 'orange';
      fixtures: number;
      competitions: number;
    }
  | {
      kind: 'coupons_missing';
      light: 'engine';
      severity: 'red';
      forDate: string;
    }
  | {
      kind: 'analysis_stopped';
      light: 'engine';
      severity: 'red';
      hours: number | null;
    }
  | {
      kind: 'product_absent';
      light: 'engine';
      severity: 'orange';
      product: string;
      days: number;
      window: number;
    }
  | {
      kind: 'market_suspended';
      light: 'engine';
      severity: 'orange';
      market: string;
      since: string;
    }
  | {
      kind: 'ai_silent';
      light: 'engine';
      severity: 'orange';
      hours: number | null;
    }
  | {
      kind: 'players_silent';
      light: 'players';
      severity: 'red';
      hours: number | null;
    }
  | {
      kind: 'support_unanswered';
      light: 'players';
      severity: 'orange';
      count: number;
    };

/** GET /console/status: the three lights, then « À faire », reds first. */
export type ConsoleStatus = {
  at: string;
  lights: Record<LightKey, LightState>;
  todo: TodoItem[];
};

/** What the repository reads, the rules decide (console-rules.ts). */
export type ConsoleSignals = {
  now: Date;
  lastOddsAt: Date | null;
  etlFailures: {
    count: number;
    lastBody: string | null;
    quotaBody: string | null;
  };
  statsLate: { fixtures: number; competitions: number };
  tomorrowCoupons: number;
  lastAnalysisAt: Date | null;
  lastAiAt: Date | null;
  absences: { product: string; days: number; today: boolean }[];
  suspendedMarkets: { market: string; since: Date }[];
  lastPlayerSeenAt: Date | null;
  unansweredMessages: number;
};
