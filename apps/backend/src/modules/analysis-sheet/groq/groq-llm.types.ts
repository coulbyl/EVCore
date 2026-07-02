export type LlmRole = 'system' | 'user';

export type LlmMessage = {
  role: LlmRole;
  content: string;
};

export type LlmUsageTokens = {
  inputTokens: number;
  outputTokens: number;
};

export type LlmResponse = {
  content: string;
  model: string;
  usage: LlmUsageTokens;
};

export type LlmClient = {
  complete(input: {
    messages: LlmMessage[];
    model?: string;
  }): Promise<LlmResponse>;
};
