export const CHAT_PROMPT_VERSION = 'eva-v6b-2026-06-14';

export const CHAT_MODELS = {
  scout: 'meta-llama/llama-4-scout-17b-16e-instruct',
  light: 'llama-3.1-8b-instant',
} as const;

export const CHAT_LIMITS = {
  historyMessages: 10,
  maxToolIterations: 5,
  maxMessageLength: 2000,
  maxToolRows: 30,
  maxEvaFixtures: 15,
  maxEvaPicksPerFixture: 4,
  defaultDailyLimit: 50,
  maxConversationsPerUser: 5,
  groqTimeoutMs: 30_000,
  maxOutputTokens: 1024,
  maxStreamPicks: 6,
} as const;

// Redis cache invalidation tags — used by workers to purge stale chat cache on events.
export const CHAT_CACHE_TAGS = {
  settlement: 'chat-settlement',
  mlModel: 'chat-ml-model',
  engineHealth: 'chat-engine-health',
} as const;

// Redis cache TTL (seconds) per repository read method.
export const CHAT_CACHE_TTL = {
  channelPerfLive: 5 * 60,
  channelPerfHistorical: 24 * 3600,
  leagueStatsLive: 5 * 60,
  leagueStatsHistorical: 24 * 3600,
  settledOutcomesLive: 5 * 60,
  settledOutcomesHistorical: 24 * 3600,
  edgeStatsLive: 5 * 60,
  edgeStatsHistorical: 24 * 3600,
  engineHealth: 2 * 60,
  mlModelVersions: 60 * 60,
  userBetStats: 60,
  searchFixtures: 10 * 60,
  explainFixture: 5 * 60,
  picksWithEvaluation: 3 * 60,
} as const;

// Ranking weights used by ChatPickEngineService to order engine picks.
export const CHAT_RANK_WEIGHTS = {
  value: { signalScore: 0.45, probability: 0.55 },
} as const;

export const CHAT_TOOL_LABELS: Record<string, string> = {
  searchFixtures: 'Recherche des fixtures...',
  getTopPicks: 'Selection des meilleurs picks...',
  getUpcomingPicks: 'Recherche des picks a venir...',
  getCouponProposals: 'Lecture des coupons moteur...',
  composeSelection: 'Composition de la selection...',
  simulateLadder: 'Simulation de la montante...',
  planLadder: 'Construction de la montante...',
  explainFixture: 'Analyse de la fixture...',
  getChannelPerformance: 'Calcul des performances par canal...',
  getLeaguePerformance: 'Analyse des ligues...',
  getLeagueChannelConfig: 'Lecture de la configuration des ligues...',
  getPredictionOutcomes: 'Chargement des resultats...',
  getSegmentPerformance: 'Calcul des performances par segment...',
  getMLMetrics: 'Lecture des metriques ML...',
  getEdgeAnalysis: "Analyse de l'edge vs marche...",
  getEngineHealth: 'Diagnostic du moteur...',
  getPicksWithEvaluation: 'Analyse des picks du jour...',
  getMyStats: 'Chargement de vos statistiques...',
};
