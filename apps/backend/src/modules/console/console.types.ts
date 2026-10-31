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
      kind: 'channel_alert';
      light: 'engine';
      severity: 'orange';
      channel: string;
      competition: string;
      ratio: number;
      sample: number;
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
  /** Since when each light is in its state, as last recorded; null if not yet. */
  since: Record<LightKey, string | null>;
  todo: TodoItem[];
  /** « 12 joueurs actifs hier · 3 suivis · 1 inscrit » (players, not the team). */
  yesterday: { active: number; follows: number; signups: number };
  /** The scheduled passes cut (Réglages): since when, by whom; null if on. */
  passesOff: { since: string; by: string | null } | null;
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
  /** Channel × competition cells in alert (Moteur). */
  channelAlerts: {
    channel: string;
    competition: string;
    ratio: number;
    sample: number;
  }[];
};

/** Moteur › Produits (12 § 2): Résultats' line, and what a player never sees. */
export type EngineProduct = {
  product: string;
  retired: boolean;
  launchedOn: string;
  won: number;
  lost: number;
  refunded: number;
  tooEarly: boolean;
  /** Mean announced chance and realised rate, null while too early. */
  announced: number | null;
  realised: number | null;
  /** Legs of the period's coupons; their mean closing line value and 1xBet margin. */
  legs: number;
  clv: number | null;
  margin: number | null;
};

/** The AI's line, and its record by configuration version. */
export type EngineAi = {
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

/** GET /console/engine/products?period=. */
export type EngineProducts = {
  period: string;
  products: EngineProduct[];
  ai: EngineAi;
};

/** A cell of Moteur › Canaux × compétition. */
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
  /** conforme, optimiste (below 0,85, not established), alerte, pas assez de recul. */
  word: 'conforme' | 'optimistic' | 'alert' | 'not_enough';
};

/** A market suspended by the risk sweep, until a human reactivates it. */
export type SuspendedMarket = {
  id: string;
  market: string;
  since: string;
  reason: string;
};
