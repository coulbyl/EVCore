/**
 * The operator switches (docs/refonte-ui/12-admin.md § 4, ENV-PROD § 6):
 * five settings an operator may change the same evening without a deploy,
 * stored in the `app_setting` table (one row per key, JSON value), read on
 * every pass by apps/backend and apps/vantage-worker. Everything else is a
 * decision in code or a secret in the .env; no secret ever enters here.
 *
 * The code works without the table: a missing, unreadable or malformed row
 * is its default. `null` from a parser means « malformed, use the default ».
 */
export const LLM_PROVIDERS = [
  "groq",
  "cerebras",
  "together",
  "fireworks",
] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export const RESEARCH_PROVIDERS = ["groq", "tavily"] as const;
export type ResearchProviderName = (typeof RESEARCH_PROVIDERS)[number];

export type AppSettings = {
  /** The provider of the verdict call, then the ordered fallbacks. */
  "llm.providers": { primary: LlmProviderName; fallbacks: LlmProviderName[] };
  /** Web research before the verdict: on/off, provider, competitions. */
  research: {
    enabled: boolean;
    provider: ResearchProviderName;
    competitionCodes: string[];
  };
  /** Percent of the API-Football daily quota that raises an alert. */
  "apiFootball.quotaAlertPct": number;
  /** API-Football calls per day the stats backfill leaves to routine work. */
  "statsBackfill.dailyReserve": number;
  /** Every scheduled pass on or off — for an incident only. */
  "scheduling.enabled": boolean;
};

export type AppSettingKey = keyof AppSettings;

export const APP_SETTING_KEYS = [
  "llm.providers",
  "research",
  "apiFootball.quotaAlertPct",
  "statsBackfill.dailyReserve",
  "scheduling.enabled",
] as const satisfies readonly AppSettingKey[];

/** The big leagues and the European cups (vantage-worker's default). */
export const DEFAULT_RESEARCH_COMPETITION_CODES = [
  "PL",
  "LL",
  "BL1",
  "SA",
  "L1",
  "UCL",
  "UEL",
  "UECL",
];

/**
 * Defaults when a row is absent. The LLM chain and research have no
 * default here: each app falls back on what its environment still says
 * (LLM_PROVIDER, VANTAGE_ENABLE_RESEARCH…) until the row is written.
 */
export const APP_SETTING_DEFAULTS = {
  "apiFootball.quotaAlertPct": 80,
  "statsBackfill.dailyReserve": 2_500,
  "scheduling.enabled": true,
} as const satisfies Partial<AppSettings>;

function isOneOf<T extends string>(
  values: readonly T[],
  value: unknown,
): value is T {
  return (
    typeof value === "string" && (values as readonly string[]).includes(value)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A stored value checked against its key's shape; null when malformed. */
export function parseAppSetting<K extends AppSettingKey>(
  key: K,
  raw: unknown,
): AppSettings[K] | null {
  return (PARSERS[key] as (raw: unknown) => AppSettings[K] | null)(raw);
}

const PARSERS: {
  [K in AppSettingKey]: (raw: unknown) => AppSettings[K] | null;
} = {
  "llm.providers": (raw) => {
    if (!isRecord(raw) || !isOneOf(LLM_PROVIDERS, raw["primary"])) return null;
    const fallbacks = raw["fallbacks"] ?? [];
    if (
      !Array.isArray(fallbacks) ||
      !fallbacks.every((f) => isOneOf(LLM_PROVIDERS, f))
    ) {
      return null;
    }
    return { primary: raw["primary"], fallbacks };
  },
  research: (raw) => {
    if (
      !isRecord(raw) ||
      typeof raw["enabled"] !== "boolean" ||
      !isOneOf(RESEARCH_PROVIDERS, raw["provider"])
    ) {
      return null;
    }
    const codes = raw["competitionCodes"] ?? DEFAULT_RESEARCH_COMPETITION_CODES;
    if (!Array.isArray(codes) || !codes.every((c) => typeof c === "string")) {
      return null;
    }
    return {
      enabled: raw["enabled"],
      provider: raw["provider"],
      competitionCodes: codes,
    };
  },
  "apiFootball.quotaAlertPct": (raw) =>
    typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 100
      ? raw
      : null,
  "statsBackfill.dailyReserve": (raw) =>
    typeof raw === "number" && Number.isInteger(raw) && raw >= 0 ? raw : null,
  "scheduling.enabled": (raw) => (typeof raw === "boolean" ? raw : null),
};
