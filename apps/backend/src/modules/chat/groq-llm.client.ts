import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CHAT_LIMITS, CHAT_MODELS } from './chat.constants';
import type {
  ChatLlmMessage,
  ChatLlmResponse,
  ChatToolCall,
  LlmClient,
} from './chat.types';

type GroqMessage = {
  role: string;
  content?: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};

type GroqResponse = {
  model?: string;
  choices?: Array<{ message?: GroqMessage }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

class GroqRequestError extends Error {
  constructor(readonly status: number) {
    super(`Groq indisponible (${status})`);
  }
}

@Injectable()
export class GroqLlmClient implements LlmClient {
  constructor(private readonly config: ConfigService) {}

  async complete(input: Parameters<LlmClient['complete']>[0]) {
    const apiKey = this.config.get<string>('GROQ_API_KEY', '');
    if (!apiKey) {
      throw new ServiceUnavailableException('GROQ_API_KEY manquante');
    }

    const model =
      input.model ??
      this.config.get<string>('CHAT_GROQ_MODEL', CHAT_MODELS.scout);

    try {
      return await this.request({ ...input, model, apiKey });
    } catch (err: unknown) {
      // Spec guard: if the main model is down or rate-limited, retry once on
      // the light model before surfacing an error to the user.
      if (model !== CHAT_MODELS.light && shouldFallback(err)) {
        try {
          return await this.request({
            ...input,
            model: CHAT_MODELS.light,
            apiKey,
          });
        } catch (fallbackErr: unknown) {
          throw toServiceError(fallbackErr);
        }
      }
      throw toServiceError(err);
    }
  }

  private async request(input: {
    messages: ChatLlmMessage[];
    tools: Parameters<LlmClient['complete']>[0]['tools'];
    toolChoice?: 'auto' | 'none';
    model: string;
    apiKey: string;
  }): Promise<ChatLlmResponse> {
    const response = await fetch(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages.map(toGroqMessage),
          tools: input.tools,
          tool_choice: input.toolChoice ?? 'auto',
          max_tokens: 700,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(CHAT_LIMITS.groqTimeoutMs),
      },
    );

    if (!response.ok) {
      throw new GroqRequestError(response.status);
    }

    const payload = (await response.json()) as GroqResponse;
    const message = payload.choices?.[0]?.message;
    if (!message) {
      throw new ServiceUnavailableException('Reponse Groq vide');
    }

    return {
      model: payload.model ?? input.model,
      message: fromGroqMessage(message),
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? 0,
        outputTokens: payload.usage?.completion_tokens ?? 0,
      },
    } satisfies ChatLlmResponse;
  }
}

function isTimeout(err: unknown): boolean {
  return (
    err instanceof DOMException &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  );
}

function shouldFallback(err: unknown): boolean {
  if (err instanceof GroqRequestError) {
    return err.status === 429 || err.status >= 500;
  }
  return isTimeout(err);
}

function toServiceError(err: unknown): Error {
  if (err instanceof GroqRequestError) {
    return new ServiceUnavailableException(err.message);
  }
  if (isTimeout(err)) {
    return new ServiceUnavailableException('Groq indisponible (timeout)');
  }
  if (err instanceof ServiceUnavailableException) return err;
  return new ServiceUnavailableException('Groq indisponible');
}

function toGroqMessage(message: ChatLlmMessage): GroqMessage {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId,
    };
  }

  return {
    role: message.role,
    content: message.content,
    ...(message.toolCalls
      ? {
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function' as const,
            function: { name: call.name, arguments: call.arguments },
          })),
        }
      : {}),
  };
}

function fromGroqMessage(message: GroqMessage): ChatLlmMessage {
  const toolCalls: ChatToolCall[] | undefined = message.tool_calls?.map(
    (call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }),
  );

  return {
    role: 'assistant',
    content: message.content ?? '',
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
  };
}
