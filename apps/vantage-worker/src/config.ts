import "dotenv/config";

export type Config = {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
  groqApiKey: string;
  groqModel: string;
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
   * does — see docs/architecture.md — Situational research (cost). */
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

export function loadConfig(): Config {
  return {
    databaseUrl: required("DATABASE_URL"),
    redisHost: process.env["REDIS_HOST"] ?? "localhost",
    redisPort: Number(process.env["REDIS_PORT"] ?? "6379"),
    groqApiKey: required("GROQ_API_KEY"),
    groqModel: process.env["GROQ_MODEL"] ?? "openai/gpt-oss-120b",
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
