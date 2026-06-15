import { z } from 'zod';
import type { ChatToolDefinition } from './chat.types';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

const boundedIntFromNumberOrString = (min: number, max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return /^\d+$/.test(trimmed) ? Number(trimmed) : value;
  }, z.number().int().min(min).max(max));

const boundedFloatFromNumberOrString = (min: number, max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : value;
  }, z.number().min(min).max(max));

const limit = boundedIntFromNumberOrString(1, 30).optional();

export const SearchFixturesArgsSchema = z.object({
  query: z.string().trim().min(2).max(100),
  from: isoDate.optional(),
  to: isoDate.optional(),
  status: z
    .enum(['SCHEDULED', 'IN_PROGRESS', 'FINISHED', 'POSTPONED', 'CANCELLED'])
    .optional(),
  limit,
});

export const CanalSchema = z.enum(['EV', 'SV', 'BB', 'NUL', 'CONF']);

export const GetTopPicksArgsSchema = z.object({
  from: isoDate,
  to: isoDate,
  perDay: boundedIntFromNumberOrString(1, 10),
  profile: z.enum(['fiable', 'value']).optional(),
});

export const GetUpcomingPicksArgsSchema = z.object({
  date: isoDate.optional(),
  canal: CanalSchema.optional(),
  limit,
});

export const GetCouponProposalsArgsSchema = z.object({
  date: isoDate.optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
});

export const ComposeSelectionArgsSchema = z.object({
  date: isoDate,
  targetOddsMin: boundedFloatFromNumberOrString(1.01, 200),
  targetOddsMax: boundedFloatFromNumberOrString(1.01, 200),
});

export const SimulateLadderArgsSchema = z.object({
  stake: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Expected decimal amount'),
  steps: z
    .array(
      z.object({
        combinedOdds: z.string().regex(/^\d+(\.\d+)?$/),
        jointProbability: z.string().regex(/^(0(\.\d+)?|\.\d+|1(\.0+)?)$/),
      }),
    )
    .min(1)
    .max(10),
});

export const ExplainFixtureArgsSchema = z.object({
  fixtureId: z.uuid(),
});

// Deterministic end-to-end ladder: the backend selects the picks AND runs the
// simulation — the LLM never assembles ladder steps itself.
export const PlanLadderArgsSchema = z.object({
  date: isoDate.optional(),
  stake: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Expected decimal amount'),
  steps: boundedIntFromNumberOrString(1, 5),
  canal: CanalSchema.optional(),
});

// ── Groupe B — Performance & confiance ──────────────────────────────────────

const channelEnum = z.enum(['EV', 'SV', 'CONF', 'DRAW', 'BTTS']);

export const GetChannelPerformanceArgsSchema = z.object({
  from: isoDate,
  to: isoDate,
  channel: channelEnum.optional(),
});

export const GetLeaguePerformanceArgsSchema = z.object({
  channel: channelEnum,
  from: isoDate,
  to: isoDate,
});

export const GetLeagueChannelConfigArgsSchema = z.object({
  competition: z.string().max(10).optional(),
});

export const GetPredictionOutcomesArgsSchema = z.object({
  from: isoDate,
  to: isoDate,
  canal: CanalSchema.optional(),
  onlyMisses: z.boolean().optional(),
});

export const GetSegmentPerformanceArgsSchema = z.object({
  from: isoDate,
  to: isoDate,
});

// ── Groupe C — ML & moteur ───────────────────────────────────────────────────

export const GetMLMetricsArgsSchema = z.object({
  segment: z.string().max(50).optional(),
});

export const GetEdgeAnalysisArgsSchema = z.object({
  from: isoDate,
  to: isoDate,
});

// ── Groupe D — Santé du moteur ───────────────────────────────────────────────

export const GetEngineHealthArgsSchema = z.object({});

// ── Groupe F — Contexte d'évaluation EVA ─────────────────────────────────────

export const GetPicksWithEvaluationArgsSchema = z.object({
  date: isoDate.optional(),
});

// ── Groupe E — Données personnelles ─────────────────────────────────────────

export const GetMyStatsArgsSchema = z.object({
  from: isoDate,
  to: isoDate,
});

export const CHAT_TOOL_SCHEMAS = {
  searchFixtures: SearchFixturesArgsSchema,
  getTopPicks: GetTopPicksArgsSchema,
  getUpcomingPicks: GetUpcomingPicksArgsSchema,
  getCouponProposals: GetCouponProposalsArgsSchema,
  composeSelection: ComposeSelectionArgsSchema,
  simulateLadder: SimulateLadderArgsSchema,
  planLadder: PlanLadderArgsSchema,
  explainFixture: ExplainFixtureArgsSchema,
  getChannelPerformance: GetChannelPerformanceArgsSchema,
  getLeaguePerformance: GetLeaguePerformanceArgsSchema,
  getLeagueChannelConfig: GetLeagueChannelConfigArgsSchema,
  getPredictionOutcomes: GetPredictionOutcomesArgsSchema,
  getSegmentPerformance: GetSegmentPerformanceArgsSchema,
  getMLMetrics: GetMLMetricsArgsSchema,
  getEdgeAnalysis: GetEdgeAnalysisArgsSchema,
  getEngineHealth: GetEngineHealthArgsSchema,
  getPicksWithEvaluation: GetPicksWithEvaluationArgsSchema,
  getMyStats: GetMyStatsArgsSchema,
} as const;

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[],
) =>
  ({
    type: 'object',
    additionalProperties: false,
    properties,
    required,
  }) satisfies Record<string, unknown>;

export const CHAT_TOOL_DEFINITIONS: ChatToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'searchFixtures',
      description:
        'Resolve a team or competition query into fixture ids and basic fixture metadata.',
      parameters: objectSchema(
        {
          query: { type: 'string', minLength: 2, maxLength: 100 },
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          status: {
            type: 'string',
            enum: [
              'SCHEDULED',
              'IN_PROGRESS',
              'FINISHED',
              'POSTPONED',
              'CANCELLED',
            ],
          },
          limit: {
            anyOf: [
              { type: 'integer', minimum: 1, maximum: 30 },
              { type: 'string', pattern: '^[1-9][0-9]?$' },
            ],
            description:
              'Max number of results, 1–30. Numeric strings accepted.',
          },
        },
        ['query'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTopPicks',
      description:
        'Deterministically select the best engine picks per day across channels.',
      parameters: objectSchema(
        {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          perDay: {
            anyOf: [
              { type: 'integer', minimum: 1, maximum: 10 },
              { type: 'string', pattern: '^([1-9]|10)$' },
            ],
            description: 'Picks per day, 1–10. Numeric strings accepted.',
          },
          profile: { type: 'string', enum: ['fiable', 'value'] },
        },
        ['from', 'to', 'perDay'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getUpcomingPicks',
      description:
        'Return pending engine picks for upcoming fixtures on one date.',
      parameters: objectSchema(
        {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          canal: { type: 'string', enum: ['EV', 'SV', 'BB', 'NUL', 'CONF'] },
          limit: {
            anyOf: [
              { type: 'integer', minimum: 1, maximum: 30 },
              { type: 'string', pattern: '^[1-9][0-9]?$' },
            ],
            description:
              'Max number of results, 1–30. Numeric strings accepted.',
          },
        },
        [],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getCouponProposals',
      description:
        'Return generated AI-engine coupon proposals for a date with legs and combined probability.',
      parameters: objectSchema(
        {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          status: {
            type: 'string',
            enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'],
          },
        },
        [],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'composeSelection',
      description:
        'Read-only composition of pending picks into a same-day selection inside a target odds range.',
      parameters: objectSchema(
        {
          date: { type: 'string', description: 'YYYY-MM-DD' },
          targetOddsMin: {
            anyOf: [{ type: 'number', minimum: 1.01 }, { type: 'string' }],
            description: 'Minimum combined odds (e.g. 1.5 or "1.5").',
          },
          targetOddsMax: {
            anyOf: [{ type: 'number', minimum: 1.01 }, { type: 'string' }],
            description: 'Maximum combined odds (e.g. 3.0 or "3.0").',
          },
        },
        ['date', 'targetOddsMin', 'targetOddsMax'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'simulateLadder',
      description:
        'Compute ladder progression, cumulative probability and expected value using decimal arithmetic.',
      parameters: objectSchema(
        {
          stake: { type: 'string', description: 'Decimal amount as string' },
          steps: {
            type: 'array',
            minItems: 1,
            maxItems: 10,
            items: objectSchema(
              {
                combinedOdds: { type: 'string' },
                jointProbability: { type: 'string' },
              },
              ['combinedOdds', 'jointProbability'],
            ),
          },
        },
        ['stake', 'steps'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'planLadder',
      description:
        'Build a complete ladder (montante) for a date: deterministically selects the most reliable engine picks with odds (one per fixture) and computes stakes, returns and cumulative probabilities with decimal arithmetic.',
      parameters: objectSchema(
        {
          date: { type: 'string', description: 'YYYY-MM-DD (default: today)' },
          stake: { type: 'string', description: 'Decimal amount as string' },
          steps: {
            anyOf: [
              { type: 'integer', minimum: 1, maximum: 5 },
              { type: 'string', pattern: '^[1-5]$' },
            ],
            description:
              'Number of ladder steps, 1 to 5. Numeric strings are accepted.',
          },
          canal: { type: 'string', enum: ['EV', 'SV', 'BB', 'NUL', 'CONF'] },
        },
        ['stake', 'steps'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'explainFixture',
      description:
        'Return model run, generated picks and no-bet context for one fixture.',
      parameters: objectSchema(
        { fixtureId: { type: 'string', format: 'uuid' } },
        ['fixtureId'],
      ),
    },
  },
  // ── Groupe B ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'getChannelPerformance',
      description:
        'Return ROI, hit rate, net units and sample size for one or all channels over a date range. Excludes backfill data.',
      parameters: objectSchema(
        {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          channel: {
            type: 'string',
            enum: ['EV', 'SV', 'CONF', 'DRAW', 'BTTS'],
          },
        },
        ['from', 'to'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getLeaguePerformance',
      description:
        'Break down a channel performance by competition (league) over a date range.',
      parameters: objectSchema(
        {
          channel: {
            type: 'string',
            enum: ['EV', 'SV', 'CONF', 'DRAW', 'BTTS'],
          },
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
        ['channel', 'from', 'to'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getLeagueChannelConfig',
      description:
        'Return the current prediction-channel configuration for each league (enabled flag, threshold, channel). Use to explain why a channel is inactive in a given league.',
      parameters: objectSchema(
        {
          competition: {
            type: 'string',
            description: 'League code (BL1, PL, SA, …). Omit for all leagues.',
          },
        },
        [],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPredictionOutcomes',
      description:
        'List settled picks (bets + predictions) with their results. Use onlyMisses=true to surface the biggest engine errors.',
      parameters: objectSchema(
        {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
          canal: {
            type: 'string',
            enum: ['EV', 'SV', 'BB', 'NUL', 'CONF'],
          },
          onlyMisses: {
            type: 'boolean',
            description: 'Sort by biggest probability error first.',
          },
        },
        ['from', 'to'],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getSegmentPerformance',
      description:
        'Aggregate ROI, hit rate and pick count for every channel (EV, SV, CONF, DRAW, BTTS) over a date range.',
      parameters: objectSchema(
        {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
        ['from', 'to'],
      ),
    },
  },
  // ── Groupe C ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'getMLMetrics',
      description:
        'Return ML model versions: algorithm, Brier score, ROI shadow, sample size, activation date. OPERATOR sees active models only; ADMIN sees full history.',
      parameters: objectSchema(
        {
          segment: {
            type: 'string',
            description:
              'Segment filter, e.g. "EV:ONE_X_TWO". Omit for all segments.',
          },
        },
        [],
      ),
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEdgeAnalysis',
      description:
        'Compare estimated probability vs market-implied odds (edge = prob - 1/odds) for settled EV/SV bets. Surfaces structural biases by segment.',
      parameters: objectSchema(
        {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
        ['from', 'to'],
      ),
    },
  },
  // ── Groupe D ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'getEngineHealth',
      description:
        'Return engine readiness: last ETL sync timestamps, fixtures missing odds today, and active market suspensions.',
      parameters: objectSchema({}, []),
    },
  },
  // ── Groupe F ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'getPicksWithEvaluation',
      description:
        'Return the full analyst evaluation context for all fixtures on a date: accepted picks, rejected picks with rejection reasons, shadow signals, lambdas, and data quality flags. Use this tool — not getUpcomingPicks — when the user asks what to bet today, which matches to pick, or what the engine recommends. Enables EVA to prioritise, contextualise, and explain picks instead of listing them.',
      parameters: objectSchema(
        {
          date: {
            type: 'string',
            description: 'YYYY-MM-DD (default: today)',
          },
        },
        [],
      ),
    },
  },
  // ── Groupe E ─────────────────────────────────────────────────────────────
  {
    type: 'function',
    function: {
      name: 'getMyStats',
      description:
        "Return the authenticated user's personal betting stats: ROI, hit rate, settled picks count over a date range.",
      parameters: objectSchema(
        {
          from: { type: 'string', description: 'YYYY-MM-DD' },
          to: { type: 'string', description: 'YYYY-MM-DD' },
        },
        ['from', 'to'],
      ),
    },
  },
];

export type ChatToolName = keyof typeof CHAT_TOOL_SCHEMAS;
