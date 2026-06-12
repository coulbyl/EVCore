import type { AuthSessionUser } from '@modules/auth/auth.types';

export type ChatRole = 'user' | 'assistant' | 'tool' | 'system';

export type ChatToolCall = {
  id: string;
  name: string;
  arguments: string;
};

export type ChatLlmMessage = {
  role: ChatRole;
  content: string;
  toolCallId?: string;
  toolCalls?: ChatToolCall[];
};

export type ChatUsageTokens = {
  inputTokens: number;
  outputTokens: number;
};

export type ChatLlmResponse = {
  message: ChatLlmMessage;
  model: string;
  usage: ChatUsageTokens;
};

export type ChatToolDefinition = {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type ChatRequestUser = Pick<AuthSessionUser, 'id' | 'role' | 'currency'>;

// Compact engine pick pushed to the UI as a card alongside the answer.
export type ChatStreamPick = {
  canal: string;
  match: string;
  market: string;
  pick: string;
  odds: number | null;
  proba: number;
  reliability: number | null;
};

export type ChatStreamEvent =
  | { event: 'tool_start'; data: { tool: string; label: string } }
  | { event: 'tool_end'; data: { tool: string; ms: number } }
  | { event: 'token'; data: { text: string } }
  // Drop the partial text: the provider failed mid-stream and a fallback
  // model is about to re-stream the answer from scratch.
  | { event: 'reset'; data: { reason: string } }
  | { event: 'picks'; data: { tool: string; picks: ChatStreamPick[] } }
  | {
      event: 'done';
      data: { messageId: string; inputTokens: number; outputTokens: number };
    }
  | { event: 'error'; data: { code: string; message: string } };

export type ChatStreamWriter = (event: ChatStreamEvent) => void;

export type LlmClient = {
  complete(input: {
    messages: ChatLlmMessage[];
    tools: ChatToolDefinition[];
    toolChoice?: 'auto' | 'none';
    model?: string;
    // Called for each content delta when the provider streams.
    onToken?: (text: string) => void;
    // Called before a fallback retry that follows already-emitted tokens —
    // the consumer must discard the partial text.
    onReset?: () => void;
  }): Promise<ChatLlmResponse>;
};
