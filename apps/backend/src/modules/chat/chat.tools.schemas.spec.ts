import { describe, expect, it } from 'vitest';
import { CHAT_TOOL_DEFINITIONS, CHAT_TOOL_SCHEMAS } from './chat.tools.schemas';

describe('CHAT_TOOL_SCHEMAS.planLadder', () => {
  it('accepts numeric string steps from LLM tool calls', () => {
    const result = CHAT_TOOL_SCHEMAS.planLadder.parse({
      stake: '1000',
      steps: '3',
    });

    expect(result.steps).toBe(3);
  });

  it('rejects non-integer string steps', () => {
    const result = CHAT_TOOL_SCHEMAS.planLadder.safeParse({
      stake: '1000',
      steps: '3.5',
    });

    expect(result.success).toBe(false);
  });

  it('exposes a Groq-tolerant steps parameter schema', () => {
    const planLadder = CHAT_TOOL_DEFINITIONS.find(
      (tool) => tool.function.name === 'planLadder',
    );

    expect(planLadder?.function.parameters).toMatchObject({
      properties: {
        steps: {
          anyOf: [
            { type: 'integer', minimum: 1, maximum: 5 },
            { type: 'string', pattern: '^[1-5]$' },
          ],
        },
      },
    });
  });
});
