import "dotenv/config";

/** Every provider here speaks the same OpenAI-compatible chat-completions
 * shape (groq-sdk's client accepts a `baseURL` override, so one SDK class
 * drives all four — see groq/client.ts). Adding a fifth provider is a new
 * entry here, nothing else. */
export type LlmProvider = "groq" | "cerebras" | "together" | "fireworks";

type ProviderDefaults = {
  /** Env var carrying this provider's API key. */
  apiKeyEnv: string;
  /** Env var letting the model be overridden for this provider. */
  modelEnv: string;
  /** Fallback model id when `modelEnv` is unset — gpt-oss-120b everywhere,
   * since that's the model VANTAGE's prompt/JSON-mode contract was tuned
   * against; only the id format differs per provider. */
  model: string;
  /** OpenAI-compatible base URL. Omitted for Groq — groq-sdk's own default
   * (https://api.groq.com) applies. */
  baseURL?: string;
};

// Rate-limit note (2026-08-28): Groq's shared on-demand tier caps at 8000
// TPM and its self-serve Developer tier upgrade has been unavailable "due to
// high demand" — see vantage-worker job failures logged that day. Cerebras
// serves this exact model (gpt-oss-120b) behind an OpenAI-compatible
// endpoint with a real self-serve Developer tier, so it's the recommended
// LLM_PROVIDER=cerebras fallback until Groq's tier reopens.
const PROVIDER_DEFAULTS: Record<LlmProvider, ProviderDefaults> = {
  groq: {
    apiKeyEnv: "GROQ_API_KEY",
    modelEnv: "GROQ_MODEL",
    model: "openai/gpt-oss-120b",
  },
  cerebras: {
    apiKeyEnv: "CEREBRAS_API_KEY",
    modelEnv: "CEREBRAS_MODEL",
    model: "gpt-oss-120b",
    baseURL: "https://api.cerebras.ai/v1",
  },
  together: {
    apiKeyEnv: "TOGETHER_API_KEY",
    modelEnv: "TOGETHER_MODEL",
    model: "openai/gpt-oss-120b",
    baseURL: "https://api.together.xyz/v1",
  },
  fireworks: {
    apiKeyEnv: "FIREWORKS_API_KEY",
    modelEnv: "FIREWORKS_MODEL",
    model: "accounts/fireworks/models/gpt-oss-120b",
    baseURL: "https://api.fireworks.ai/inference/v1",
  },
};

/** A provider fully resolved to callable settings — used for both the
 * primary provider and each configured fallback. */
export type ResolvedLlmProvider = {
  provider: LlmProvider;
  apiKey: string;
  model: string;
  baseUrl: string | undefined;
};

export type Config = {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  /** Which OpenAI-compatible provider serves the verdict call. Switch with
   * LLM_PROVIDER — defaults to "groq" so existing deployments are untouched. */
  llmProvider: LlmProvider;
  llmApiKey: string;
  llmModel: string;
  llmBaseUrl: string | undefined;
  /** Ordered fallback providers, tried in sequence when the primary call
   * fails with a transient error (429 rate limit, 5xx, connection/timeout —
   * see groq/client.ts's isRetryableProviderError). Configured via
   * LLM_PROVIDER_FALLBACKS, e.g. "cerebras,together". Empty by default — no
   * fallback happens unless explicitly opted into. Each name listed here
   * requires its own API key env var, same as the primary: a fallback that
   * silently doesn't work is worse than no fallback, especially since it
   * would only be discovered during the exact outage it exists for. */
  llmFallbackProviders: ResolvedLlmProvider[];
  logLevel: string;
  /** How often the sweep looks for fixtures ready for analysis, in ms. */
  sweepIntervalMs: number;
  /** Only analyze fixtures in these leagues (competition codes). Empty = all
   * active competitions — the agreed default (budget covers all 68
   * comfortably without web search; see docs/architecture.md — Rollout).
   * Kept as an explicit opt-IN restriction, never a silent "all" default a
   * league could be missing from by omission. */
  competitionCodes: string[];
  /** Whether to spend a `groqResearchModel` call on live web search before
   * the verdict call. OFF by default: unlike the verdict call, search is
   * billed per-request ($5-8/1000) on top of tokens, so it does not stay
   * negligible at full 68-league volume the way the verdict-only pipeline
   * does — see docs/architecture.md — Situational research (cost).
   * Only takes effect on `llmProvider: "groq"` — `groq/compound` (native
   * Tavily web search) has no equivalent on the other providers, so
   * research.ts degrades to "no research available" on a non-Groq provider
   * regardless of this flag. */
  enableResearch: boolean;
  groqResearchModel: string;
  /** Which competitions get the (costed) research call, independent from
   * `competitionCodes` above — VANTAGE still writes a verdict everywhere,
   * research just doesn't run everywhere. Defaults to the "grands
   * championnats" (top-5 European leagues + Champions League) rather than
   * to "all", on purpose: unlike `competitionCodes`, an empty/unset value
   * here must never silently mean "every league" — that's exactly the
   * cost mistake this list exists to prevent. Override with
   * VANTAGE_RESEARCH_COMPETITION_CODES if the big-leagues default isn't
   * what you want. */
  researchCompetitionCodes: string[];
};

// PL=Premier League(ENG), LL=La Liga(ESP), BL1=Bundesliga(GER),
// SA=Serie A(ITA), L1=Ligue 1(FRA), UCL=Champions League(Europe),
// UEL=Europa League(Europe), UECL=Europa Conference League(Europe).
const DEFAULT_RESEARCH_COMPETITION_CODES = [
  "PL",
  "LL",
  "BL1",
  "SA",
  "L1",
  "UCL",
  "UEL",
  "UECL",
];

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function isLlmProvider(value: string): value is LlmProvider {
  return value in PROVIDER_DEFAULTS;
}

export function loadConfig(): Config {
  const requestedProvider = process.env["LLM_PROVIDER"] ?? "groq";
  if (!isLlmProvider(requestedProvider)) {
    throw new Error(
      `Unknown LLM_PROVIDER "${requestedProvider}" — expected one of: ${Object.keys(PROVIDER_DEFAULTS).join(", ")}`,
    );
  }
  const providerDefaults = PROVIDER_DEFAULTS[requestedProvider];

  const fallbackNames = (process.env["LLM_PROVIDER_FALLBACKS"] ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const llmFallbackProviders: ResolvedLlmProvider[] = [];
  for (const name of fallbackNames) {
    if (!isLlmProvider(name)) {
      throw new Error(
        `Unknown provider "${name}" in LLM_PROVIDER_FALLBACKS — expected one of: ${Object.keys(PROVIDER_DEFAULTS).join(", ")}`,
      );
    }
    if (name === requestedProvider) continue; // falling back to itself is a no-op
    const fallbackDefaults = PROVIDER_DEFAULTS[name];
    llmFallbackProviders.push({
      provider: name,
      apiKey: required(fallbackDefaults.apiKeyEnv),
      model: process.env[fallbackDefaults.modelEnv] ?? fallbackDefaults.model,
      baseUrl: fallbackDefaults.baseURL,
    });
  }

  return {
    databaseUrl: required("DATABASE_URL"),
    redisHost: process.env["REDIS_HOST"] ?? "localhost",
    redisPort: Number(process.env["REDIS_PORT"] ?? "6379"),
    llmProvider: requestedProvider,
    llmApiKey: required(providerDefaults.apiKeyEnv),
    llmModel: process.env[providerDefaults.modelEnv] ?? providerDefaults.model,
    llmBaseUrl: providerDefaults.baseURL,
    llmFallbackProviders,
    logLevel: process.env["LOG_LEVEL"] ?? "info",
    sweepIntervalMs: Number(process.env["SWEEP_INTERVAL_MS"] ?? "300000"),
    competitionCodes: (process.env["VANTAGE_COMPETITION_CODES"] ?? "")
      .split(",")
      .map((code) => code.trim())
      .filter(Boolean),
    enableResearch: ["1", "true", "yes", "on"].includes(
      (process.env["VANTAGE_ENABLE_RESEARCH"] ?? "").toLowerCase(),
    ),
    groqResearchModel:
      process.env["GROQ_RESEARCH_MODEL"] ?? "groq/compound-mini",
    researchCompetitionCodes: process.env["VANTAGE_RESEARCH_COMPETITION_CODES"]
      ? process.env["VANTAGE_RESEARCH_COMPETITION_CODES"]
          .split(",")
          .map((code) => code.trim())
          .filter(Boolean)
      : DEFAULT_RESEARCH_COMPETITION_CODES,
  };
}
