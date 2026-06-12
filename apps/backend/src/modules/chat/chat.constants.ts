export const CHAT_PROMPT_VERSION = 'eva-v3-2026-06-12';

export const CHAT_MODELS = {
  scout: 'meta-llama/llama-4-scout-17b-16e-instruct',
  light: 'llama-3.1-8b-instant',
} as const;

export const CHAT_LIMITS = {
  historyMessages: 10,
  maxToolIterations: 5,
  maxMessageLength: 2000,
  maxToolRows: 30,
  defaultDailyLimit: 50,
  groqTimeoutMs: 30_000,
  maxOutputTokens: 1024,
  // Max structured picks pushed to the UI per tool result.
  maxStreamPicks: 6,
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
  explainFixture: 'Analyse de la fixture...',
};
