import { z } from 'zod';
import type { ChatToolDefinition } from './chat.types';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date');

const limit = z.number().int().min(1).max(30).optional();

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
  perDay: z.number().int().min(1).max(10),
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
  targetOddsMin: z.number().min(1.01).max(200),
  targetOddsMax: z.number().min(1.01).max(200),
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
  fixtureId: z.string().uuid(),
});

export const CHAT_TOOL_SCHEMAS = {
  searchFixtures: SearchFixturesArgsSchema,
  getTopPicks: GetTopPicksArgsSchema,
  getUpcomingPicks: GetUpcomingPicksArgsSchema,
  getCouponProposals: GetCouponProposalsArgsSchema,
  composeSelection: ComposeSelectionArgsSchema,
  simulateLadder: SimulateLadderArgsSchema,
  explainFixture: ExplainFixtureArgsSchema,
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
          limit: { type: 'integer', minimum: 1, maximum: 30 },
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
          perDay: { type: 'integer', minimum: 1, maximum: 10 },
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
          limit: { type: 'integer', minimum: 1, maximum: 30 },
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
          targetOddsMin: { type: 'number', minimum: 1.01 },
          targetOddsMax: { type: 'number', minimum: 1.01 },
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
      name: 'explainFixture',
      description:
        'Return model run, generated picks and no-bet context for one fixture.',
      parameters: objectSchema(
        { fixtureId: { type: 'string', format: 'uuid' } },
        ['fixtureId'],
      ),
    },
  },
];

export type ChatToolName = keyof typeof CHAT_TOOL_SCHEMAS;
