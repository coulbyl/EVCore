// ETL configuration constants — never hardcode these inline

import { currentSeason } from '@utils/date.utils';

// Default season start month for leagues with a standard Europe-like calendar.
// Override per competition via the DB `seasonStartMonth` field.
export const DEFAULT_SEASON_START_MONTH = 7; // August (0-indexed)

export type ApiFootballDailyCallsEstimateInput = {
  leagueCount: number;
  seasonJobCount: number;
  avgScheduledFixturesPerLeaguePerDay: number;
  avgFinishedFixturesWithoutXgPerLeaguePerDay: number;
};

export type ApiFootballDailyCallsEstimate = {
  leagueCount: number;
  seasonJobCount: number;
  fixturesSyncCalls: number;
  settlementSyncCalls: number;
  statsSyncCalls: number;
  injuriesSyncCalls: number;
  oddsLiveSyncCalls: number;
  totalCalls: number;
};

export function estimateApiFootballDailyCalls(
  input: ApiFootballDailyCallsEstimateInput,
): ApiFootballDailyCallsEstimate {
  const { leagueCount, seasonJobCount } = input;

  const avgScheduled = Math.max(
    0,
    Math.floor(input.avgScheduledFixturesPerLeaguePerDay),
  );
  const avgFinishedWithoutXg = Math.max(
    0,
    Math.floor(input.avgFinishedFixturesWithoutXgPerLeaguePerDay),
  );

  // Daily calls by worker class:
  // - fixtures are season-level calls
  // - settlement/stats/injuries/odds-prematch are fixture-level calls
  const fixturesSyncCalls = seasonJobCount;
  const settlementSyncCalls = Math.max(1, Math.floor(leagueCount / 2));
  const statsSyncCalls = leagueCount * avgFinishedWithoutXg;
  const injuriesSyncCalls = leagueCount * avgScheduled;
  const oddsLiveSyncCalls = leagueCount * avgScheduled;

  const totalCalls =
    fixturesSyncCalls +
    settlementSyncCalls +
    statsSyncCalls +
    injuriesSyncCalls +
    oddsLiveSyncCalls;

  return {
    leagueCount,
    seasonJobCount,
    fixturesSyncCalls,
    settlementSyncCalls,
    statsSyncCalls,
    injuriesSyncCalls,
    oddsLiveSyncCalls,
    totalCalls,
  };
}

export const ETL_CONSTANTS = {
  // --- API-FOOTBALL (single provider for fixtures, results, future odds) ---
  API_FOOTBALL_BASE: 'https://v3.football.api-sports.io',
  // Pro plan: 7 500 req/day — keep conservative staggering between season jobs
  API_FOOTBALL_RATE_LIMIT_MS: 6_000,
  // Delay between /fixtures/statistics calls within a stats-sync job (per fixture)
  STATS_RATE_LIMIT_MS: 2_000,
  // Prematch odds are fetched for fixtures from J+1 up to J+horizon so each
  // fixture accumulates several snapshots before kickoff — this is what feeds
  // the line-movement shadow signal (one snapshot per fixture = no movement).
  ODDS_PREMATCH_HORIZON_DAYS: 3,
  // Routine fixtures-sync is forward-only (no lookback — see
  // backfillFixturesOnSeasonRollover in etl.service.ts for the season-start
  // gap that lookback would otherwise be needed for). J+0 up to J+horizon
  // keeps schedule changes (postponements, kickoff-time moves) fresh ahead
  // of kickoff without a full season refetch every run.
  FIXTURES_ROUTINE_LOOKAHEAD_DAYS: 3,
  // Alert (log + notification) when the daily request counter crosses this
  // share of the plan's quota. Read best-effort from /status after sync jobs.
  API_FOOTBALL_QUOTA_ALERT_RATIO: 0.8,
  // Fallback xG proxy when expected_goals is absent from the API response.
  // Used for 2022-23 first half where API-Football did not yet track xG.
  XG_SHOTS_PROXY_FACTOR: 0.4,

  // --- football-data.co.uk CSV — historical odds one-shot import ---
  // Closing odds (Pinnacle + Bet365) for EV backtest. Free, no auth required.
  CSV_ODDS_BASE: 'https://www.football-data.co.uk/mmz4281',
  // World Football Elo Ratings export used by the FRI fallback reference model.
  ELO_RATINGS_WORLD_TSV_URL: 'https://eloratings.net/World.tsv',

  // --- The Odds API — historical odds import for European competitions ---
  THE_ODDS_API_BASE: 'https://api.the-odds-api.com/v4',
  // Rate-limit between requests (historical endpoint charges credits per call).
  THE_ODDS_API_RATE_LIMIT_MS: 500,
} as const;

// Sport keys used by The Odds API.
// Used by the odds-historical-import worker.
export const THE_ODDS_API_SPORT_KEYS = {
  // UEFA
  UCL: 'soccer_uefa_champs_league',
  UEL: 'soccer_uefa_europa_league',
  UECL: 'soccer_uefa_europa_conference_league',
  // Top 5 domestic leagues
  PL: 'soccer_epl',
  SA: 'soccer_italy_serie_a',
  L1: 'soccer_france_ligue_one',
  LL: 'soccer_spain_la_liga',
  BL1: 'soccer_germany_bundesliga',
  // Secondary domestic leagues
  CH: 'soccer_efl_champ',
  D2: 'soccer_germany_bundesliga2',
  SP2: 'soccer_spain_segunda_division',
  ERD: 'soccer_netherlands_eredivisie',
  // Lower divisions
  EL1: 'soccer_england_league1',
  EL2: 'soccer_england_league2',
  F2: 'soccer_france_ligue_two',
  I2: 'soccer_italy_serie_b',
  // Other domestic leagues
  POR: 'soccer_portugal_primeira_liga',
  // New leagues
  POL1: 'soccer_poland_ekstraklasa',
  SWE1: 'soccer_sweden_allsvenskan',
  SWE2: 'soccer_sweden_superettan',
  SUI1: 'soccer_switzerland_superleague',
  TUR1: 'soccer_turkey_super_league',
  MLS: 'soccer_usa_mls',
  NOR1: 'soccer_norway_eliteserien',
  // Asie / Amériques / Nordiques
  BRA1: 'soccer_brazil_campeonato',
  CSL: 'soccer_china_superleague',
  FIN1: 'soccer_finland_veikkausliiga',
  KOR1: 'soccer_korea_kleague1',
  // International
  J1: 'soccer_japan_j_league',
  MX1: 'soccer_mexico_ligamx',
  UNL: 'soccer_uefa_nations_league',
  // FIFA World Cup — clé active uniquement pendant le tournoi (11 juin–19 juillet 2026)
  WC: 'soccer_fifa_world_cup',
  // New leagues (Groupe A round 2, 2026-07)
  ARG1: 'soccer_argentina_primera_division',
  AUT1: 'soccer_austria_bundesliga',
  DEN1: 'soccer_denmark_superliga',
  IRL1: 'soccer_league_of_ireland',
  SCO1: 'soccer_spl',
  BRA2: 'soccer_brazil_serie_b',
  // Clés ci-dessous inactive côté The Odds API au 2026-07-05 (trêve estivale
  // ou reprise à venir) — clés existantes, réactivation attendue à la reprise
  // de saison, pas de retrait à prévoir.
  BEL1: 'soccer_belgium_first_div',
  GRE1: 'soccer_greece_super_league',
  RUS1: 'soccer_russia_premier_league',
  KSA1: 'soccer_saudi_arabia_pro_league',
  AUS1: 'soccer_australia_aleague',
  CHI1: 'soccer_chile_campeonato',
  D3: 'soccer_germany_liga3',
  // WC qualifiers — The Odds API only publishes a dedicated key for these two
  // confederations (verified 2026-07-09 against /v4/sports?all=true); Africa/
  // Asia/CONCACAF/Oceania have no equivalent key at all, not a config gap.
  WCQE: 'soccer_fifa_world_cup_qualifiers_europe',
  WCQSA: 'soccer_fifa_world_cup_qualifiers_south_america',
} as const;

// Returns the current season code in football-data.co.uk format (YYZZ).
// Example: 2026-03 → '2526'
export function getCurrentCsvSeasonCode(now: Date = new Date()): string {
  const year = currentSeason(DEFAULT_SEASON_START_MONTH, now);
  return `${String(year).slice(2)}${String(year + 1).slice(2)}`;
}

// Returns season codes for an explicit list of start-years in football-data.co.uk
// format (YYZZ). Used by backtest endpoints to import historical odds.
// Example: [2022, 2023] → ['2223', '2324']
export function csvSeasonCodes(years: number[]): string[] {
  return years.map((y) => `${String(y).slice(2)}${String(y + 1).slice(2)}`);
}

// Bookmaker IDs in the API-Football odds endpoint
export const API_FOOTBALL_BOOKMAKERS = {
  PINNACLE: 4,
  BET365: 8,
  UNIBET: 16,
  MARATHONBET: 2,
  BWIN: 6,
  // Added 2026-09-15 (plan de rentabilité, chantier A). Mesure sur 12
  // rencontres : 1xBet price le Match Winner à 2,77 % de marge et Betano à
  // 3,45 %, contre 3,32 % pour Pinnacle et 5,31 % pour Marathonbet. On payait
  // donc la marge la plus chère du carnet faute de les collecter.
  ONE_X_BET: 11,
  BETANO: 32,
  WILLIAM_HILL: 7,
  BETFAIR: 3,
  BETVICTOR: 36,
  SBO: 5,
} as const;

/**
 * Books dont les cotes sont STOCKÉES, par ordre de priorité. Le premier
 * présent sur une rencontre devient le book primaire : c'est lui qui porte le
 * snapshot complet (marchés secondaires compris), d'où Pinnacle en tête.
 *
 * Volontairement distinct de COHERENCE_BOOKMAKERS (ev.constants.ts) : élargir
 * la collecte ne doit pas déplacer la médiane du garde-fou de cohérence, qui
 * pilote des décisions en production. On collecte large, on décide sur un
 * périmètre stable, et on ne change le second qu'après mesure.
 */
/**
 * Marchés collectés chez un SEUL book de référence (Pinnacle), au lieu des
 * onze.
 *
 * Mesure du 2026-09-15 sur 100 rencontres : corners 6,58 %, cartons 6,44 %,
 * second-half over/under 5,83 % — tous plus chers que ce qu'on joue déjà
 * (Asian Handicap 4,26 %, Match Winner 4,84 %). Ils ne sont donc pas des
 * cibles de pari, et le courtage multi-books n'y sert à rien.
 *
 * L'enjeu est le volume : ces marchés pèsent 44 % des 424 lignes par match
 * que la collecte élargie produit, soit 62 M de lignes par an à cadence
 * actuelle et 124 M une fois le balayage de clôture en place. Garder le seul
 * prix Pinnacle préserve la capacité à les ré-étudier sans payer la
 * démultiplication.
 *
 * Un marché sort de cette liste dès qu'une mesure le rend jouable.
 */
export const REFERENCE_ONLY_MARKETS = [
  'OVER_UNDER_2H',
  'CORNERS',
  'CORNERS_HT',
  'CARDS',
  'ODD_EVEN',
  'ODD_EVEN_HT',
  'HIGHEST_SCORING_HALF',
  'TEAM_TO_SCORE_FIRST',
] as const;

/** Book de référence pour les marchés étudiés mais non joués. */
export const REFERENCE_BOOKMAKER = 'Pinnacle';

export const ODDS_INGESTION_BOOKMAKER_IDS = [
  API_FOOTBALL_BOOKMAKERS.PINNACLE,
  API_FOOTBALL_BOOKMAKERS.BET365,
  API_FOOTBALL_BOOKMAKERS.UNIBET,
  API_FOOTBALL_BOOKMAKERS.MARATHONBET,
  API_FOOTBALL_BOOKMAKERS.BWIN,
  API_FOOTBALL_BOOKMAKERS.ONE_X_BET,
  API_FOOTBALL_BOOKMAKERS.BETANO,
  API_FOOTBALL_BOOKMAKERS.WILLIAM_HILL,
  API_FOOTBALL_BOOKMAKERS.BETFAIR,
  API_FOOTBALL_BOOKMAKERS.BETVICTOR,
  API_FOOTBALL_BOOKMAKERS.SBO,
] as const;

// Bet type IDs in the API-Football odds endpoint
export const API_FOOTBALL_BET_IDS = {
  MATCH_WINNER: 1,
  // API-Football names this bet "Home/Away" — it is Draw No Bet (draw
  // refunded), not a raw two-way market. Confirmed live 2026-07-18: id 2
  // values on a heavy favorite (Home 1.22 / Away 4.00) match DNB pricing,
  // not Double Chance (see id 12 below). Was previously mislabeled as
  // DOUBLE_CHANCE here — fixed.
  DRAW_NO_BET: 2,
  OVER_UNDER_25: 5,
  OVER_UNDER_FIRST_HALF: 6,
  HALF_TIME_FULL_TIME: 7,
  BTTS: 8,
  // Team Total: goals scored by a single side, independent of the other.
  TEAM_TOTAL_HOME: 16,
  TEAM_TOTAL_AWAY: 17,
  FIRST_HALF_WINNER: 13,
  DOUBLE_CHANCE: 12,
  // Full-time exact score. Observation-only market (forward odds collection) —
  // no historical odds via API-Football, see TODO Étape 7 item A.
  EXACT_SCORE: 10,
  CLEAN_SHEET_HOME: 27,
  CLEAN_SHEET_AWAY: 28,
  WIN_TO_NIL_HOME: 29,
  WIN_TO_NIL_AWAY: 30,
  // Two-way market (Home/Away only) — never a third "Draw"/"Neither" value,
  // confirmed live 2026-07-18 across every fixture in the sample.
  TO_WIN_EITHER_HALF: 39,
  // Pre-combined bookmaker markets (result × goals / result × BTTS) — a
  // real joint price, not a synthetic combo. Values like "Home/Over 2.5".
  RESULT_TOTAL_GOALS: 25,
  RESULT_BTTS: 24,
  // Handicap asiatique, plein match (4) et mi-temps (19). Ajoutés le
  // 2026-09-15 : marge Pinnacle mesurée entre 2,6 % et 3,7 % selon la ligne,
  // 4,11 % en moyenne sur 40 rencontres, contre 4,52 % sur le Match Winner.
  //
  // Convention de l'API, vérifiée sur données réelles : les deux côtés d'un
  // même handicap portent le MÊME signe ("Home -0.5" et "Away -0.5"), la
  // ligne étant exprimée du point de vue du domicile. Apparier "Home -0.5"
  // avec "Away +0.5" produit des marges négatives, donc impossibles.
  ASIAN_HANDICAP: 4,
  ASIAN_HANDICAP_HT: 19,
  // Ids et formats relevés sur l'API le 2026-09-15. Les marchés de corners
  // cotent aussi des lignes entières (« Over 9 »), d'où la colonne `line`.
  OVER_UNDER_2H: 26,
  CORNERS: 45,
  CORNERS_HT: 77,
  CARDS: 80,
  ODD_EVEN: 21,
  ODD_EVEN_HT: 22,
  HIGHEST_SCORING_HALF: 11,
  TEAM_TO_SCORE_FIRST: 14,
  // Halftime variant (id 51) deferred: 0 occurrences across every
  // bookmaker in the live sample checked 2026-07-18, not just the 5
  // priority ones — no data to build or test against.
} as const;

export const BULLMQ_QUEUES = {
  ML_TRAINING: 'ml-training',
  ML_SCHEDULER: 'ml-scheduler',
  LEAGUE_SYNC: 'league-sync',
  PENDING_BETS_SETTLEMENT: 'pending-bets-settlement-sync',
  STALE_SCHEDULED_SYNC: 'stale-scheduled-sync',
  ODDS_CSV_IMPORT: 'odds-csv-import',
  ODDS_PREMATCH_SYNC: 'odds-prematch-sync',
  ELO_SYNC: 'elo-sync',
  COACH_SYNC: 'coach-sync',
  BETTING_ENGINE: 'betting-engine',
  // Historical rebuild: re-runs the betting engine on FINISHED fixtures that
  // have no ModelRun yet (idempotent), per season. Renamed from ml-backfill —
  // its role is an analytical rebuild post-purge, not an ML concern.
  BETTING_ENGINE_REBUILD: 'betting-engine-rebuild',
  // Same-day recheck (BettingEngineService.analyzeUpcoming) — closes the gap
  // BETTING_ENGINE_ANALYSIS's own comment below used to flag as deliberately
  // deferred. See ETL_CRON_SCHEDULES.SAME_DAY_ANALYSIS.
  SAME_DAY_ANALYSIS: 'same-day-analysis',
  ODDS_HISTORICAL_IMPORT: 'odds-historical-import',
  ROLLING_HORIZON: 'rolling-horizon',
  SEASON_ROLLOVER_SYNC: 'season-rollover-sync',
} as const;

/**
 * Fenêtres de capture avant coup d'envoi, en minutes.
 *
 * Deux passages par rencontre : un à une heure du coup d'envoi, un juste
 * avant. Le second donne la ligne de clôture, référence du CLV ; le premier
 * permet de mesurer la dérive ouverture → clôture (B-10).
 *
 * Les bornes sont plus larges que le pas du cron (10 min) pour absorber un
 * passage manqué ou un retard de file.
 */
/**
 * Espacement des appels dans le balayage de clôture, en millisecondes.
 *
 * Plus serré que API_FOOTBALL_RATE_LIMIT_MS (6 s) parce que la contrainte
 * n'est pas la même : au pic, 50 rencontres démarrent dans la même heure. À
 * 6 s par rencontre, la dernière du lot serait interrogée cinq minutes après
 * la première — donc APRÈS son coup d'envoi pour la fenêtre T-10, et le prix
 * récupéré ne serait pas une cote de clôture.
 *
 * Le volume reste négligeable : ~400 appels par jour pour ce balayage, sur un
 * quota de 7 500.
 */
export const ODDS_CLOSING_RATE_LIMIT_MS = 1_500;

/**
 * Part de rencontres atteintes APRÈS leur coup d'envoi au-delà de laquelle le
 * balayage de clôture est considéré défaillant. Une sur cinq suffit à rendre
 * le CLV non représentatif, et l'absence de clôture ne se voit pas dans les
 * données : elle se confond avec un relevé simplement plus ancien.
 */
export const CLOSING_MISS_ALERT_RATIO = 0.2;

export const ODDS_CLOSING_WINDOWS = [
  { name: 'T-60', fromMinutes: 50, toMinutes: 65 },
  { name: 'T-10', fromMinutes: 4, toMinutes: 14 },
] as const;

export const BULLMQ_DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 200 },
} as const;

// Cron schedules for daily/weekly ETL automation (BullMQ repeatable jobs)
export const ETL_CRON_SCHEDULES = {
  FIXTURES_SYNC: '0 2 * * *', // 02:00 UTC daily
  PENDING_BETS_SETTLEMENT: '*/30 * * * *', // every 30 minutes
  STALE_SCHEDULED_SYNC: '15 7 * * *', // 07:15 UTC daily — reconcile past fixtures still marked SCHEDULED
  STATS_SYNC: '0 4 * * *', // 04:00 UTC daily
  INJURIES_SYNC: '0 6 * * *', // 06:00 UTC daily — shadow injuries refresh
  ODDS_CSV_IMPORT: '0 5 * * 1', // 05:00 UTC every Monday
  ELO_SYNC: '0 3 * * *', // 03:00 UTC daily — refresh friendly-match Elo reference data
  // 01:00 UTC every Sunday — coach changes are rare (docs/h2h-service-v2-plan.md
  // §3.4), and a full pass is ~1725 teams * 6s rate limit ≈ 2.9h, so weekly is
  // plenty. Runs before the Sunday FIXTURES_SYNC/STATS_SYNC/INJURIES_SYNC batch.
  COACH_SYNC: '0 1 * * 0',
  // 06:00 + 18:00 UTC — two snapshots/day over the J+1..J+3 horizon so the
  // line-movement signal has points to compare. The 18:00 run stays ahead of
  // BETTING_ENGINE_ANALYSIS (20:00) so next-day fixtures analyze on fresh odds.
  ODDS_PREMATCH_SYNC: '0 6,18 * * *',
  // Toutes les 10 minutes — balayage des cotes proche du coup d'envoi
  // (chantier B du plan de rentabilité, tâches B-1 et B-2).
  //
  // Sans lui, le dernier relevé d'une rencontre tombe en médiane 7,5 h avant
  // le coup d'envoi pour Pinnacle et 43 h pour Marathonbet : il n'existe donc
  // aucune ligne de clôture, et le CLV — le seul indicateur qui dise à
  // l'avance si un pari a de la valeur — est incalculable.
  //
  // Le worker ne prend que les rencontres tombant dans les fenêtres de
  // ODDS_CLOSING_WINDOWS, pas la journée entière : chaque rencontre est
  // touchée deux fois, pas trente.
  ODDS_CLOSING_SYNC: '*/10 * * * *',
  // 07:45 UTC quotidien — balayage du garde-fou de ROI par marché
  // (chantier J, tâche J-1). Le garde-fou existait mais n'était atteignable
  // que par un appel HTTP manuel : aucun marché n'a jamais été suspendu
  // automatiquement malgré la règle documentée. Quotidien et non toutes les
  // demi-heures, parce que les alertes de ROI sont réémises à chaque passage.
  RISK_MARKET_SWEEP: '45 7 * * *',
  // 20:00 UTC daily — analyze next-day fixtures after prematch odds sync.
  // No job data is passed on the cron trigger, so BettingEngineAnalysisWorker
  // defaults to `tomorrowUtc()` (see that file) — this run NEVER targets
  // "today". Combined with ROLLING_HORIZON below (J+1..J+4, same gap): this
  // evening-before pass alone would never automatically re-analyze a
  // fixture again on its own match day before kickoff — official lineups
  // (~1h out) and any late odds movement would go unpicked-up. Closed by
  // SAME_DAY_ANALYSIS below (flagged 2026-08-28, closed 2026-09-03).
  BETTING_ENGINE_ANALYSIS: '0 20 * * *',
  ROLLING_HORIZON: '0 17 * * *', // 17:00 UTC daily — warm preview for J+1..J+4 (J+1 gets overwritten by 18:00/20:00 authoritative runs)
  // Every 30 minutes — re-analyzes only fixtures kicking off within
  // SAME_DAY_ANALYSIS_WINDOW_HOURS (default 3h) from now
  // (BettingEngineService.analyzeUpcoming), never the whole day. Closes the
  // gap BETTING_ENGINE_ANALYSIS's own comment above used to flag: official
  // lineups (~1h out) and late odds movement are now picked up close to
  // kickoff instead of only from the evening-before pass. Cadence matches
  // PENDING_BETS_SETTLEMENT below on purpose — both are "catch what changed
  // recently" sweeps, not once-daily passes.
  SAME_DAY_ANALYSIS: '*/30 * * * *',
  // 01:45 UTC daily, just before FIXTURES_SYNC (02:00) — re-derives each
  // competition's current season (activeSeasons()/apiSeasonOverride) and
  // re-upserts the league-sync job schedulers with it. Without this, a
  // season's cron scheduler stays pinned to whatever season was current at
  // the last process boot: upsertJobScheduler's job-template `data.season`
  // is fixed once and BullMQ replays it on every tick — it never
  // recomputes on its own — so a season rollover (e.g. Aug 1) got silently
  // skipped until the next redeploy. Found 2026-07-25: leagues whose new
  // season had already started weren't syncing.
  SEASON_ROLLOVER_SYNC: '45 1 * * *',
} as const;

// Stable keys for upsertJobScheduler — one per queue (idempotent on restart)
export const ETL_SCHEDULER_KEYS = {
  LEAGUE_SYNC: 'cron:league-sync',
  PENDING_BETS_SETTLEMENT: 'cron:pending-bets-settlement',
  STALE_SCHEDULED_SYNC: 'cron:stale-scheduled-sync',
  ODDS_CSV_IMPORT: 'cron:odds-csv-import',
  ODDS_CLOSING_SYNC: 'cron:odds-closing-sync',
  RISK_MARKET_SWEEP: 'cron:risk-market-sweep',
  ELO_SYNC: 'cron:elo-sync',
  COACH_SYNC: 'cron:coach-sync',
  ODDS_PREMATCH_SYNC: 'cron:odds-prematch-sync',
  BETTING_ENGINE_ANALYSIS: 'cron:betting-engine-analysis',
  SAME_DAY_ANALYSIS: 'cron:same-day-analysis',
  ROLLING_HORIZON: 'cron:rolling-horizon',
  SEASON_ROLLOVER_SYNC: 'cron:season-rollover-sync',
} as const;

export const ROLLING_HORIZON_DEFAULTS = {
  START_OFFSET_DAYS: 1,
  HORIZON_DAYS: 4,
} as const;

// Default window for SAME_DAY_ANALYSIS (BettingEngineService.analyzeUpcoming)
// — only fixtures kicking off within this many hours from "now" get
// re-analyzed on each 30-minute pass. 3h covers the "official lineups ~1h
// out" case with margin, without re-scoring fixtures still far enough away
// that nothing meaningful (lineups, late odds) has actually changed yet.
export const SAME_DAY_ANALYSIS_DEFAULT_WINDOW_HOURS = 3;
