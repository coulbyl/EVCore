import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'groq-sdk/resources/chat/completions';
import { CHAT_LIMITS, CHAT_MODELS } from './chat.constants';
import type {
  ChatLlmMessage,
  ChatLlmResponse,
  ChatToolCall,
  LlmClient,
} from './chat.types';

type CompleteInput = Parameters<LlmClient['complete']>[0];

// Groq free tier can cut a stream mid-generation; the documented reason
// arrives in the x_groq.error field of the last chunk.
class GroqStreamInterruptedError extends Error {
  constructor(reason: string) {
    super(`Stream Groq interrompu: ${reason}`);
  }
}

@Injectable()
export class GroqLlmClient implements LlmClient {
  private readonly logger = new Logger(GroqLlmClient.name);
  private sdk: Groq | null = null;

  constructor(private readonly config: ConfigService) {}

  async complete(input: CompleteInput): Promise<ChatLlmResponse> {
    const model =
      input.model ??
      this.config.get<string>('CHAT_GROQ_MODEL', CHAT_MODELS.scout);

    let emitted = false;
    const onToken = input.onToken
      ? (text: string) => {
          emitted = true;
          input.onToken?.(text);
        }
      : undefined;

    try {
      return await this.request({ ...input, onToken, model });
    } catch (err: unknown) {
      this.logError(model, err);
      // Spec guard: if the main model is down, rate-limited or cut the
      // stream, retry once on the light model before surfacing an error.
      if (model !== CHAT_MODELS.light && shouldFallback(err)) {
        // Tokens already reached the client: tell it to drop the partial
        // text before the fallback re-streams from scratch.
        if (emitted) input.onReset?.();
        try {
          return await this.request({
            ...input,
            onToken,
            model: CHAT_MODELS.light,
          });
        } catch (fallbackErr: unknown) {
          this.logError(CHAT_MODELS.light, fallbackErr);
          throw toServiceError(fallbackErr);
        }
      }
      throw toServiceError(err);
    }
  }

  private logError(model: string, err: unknown): void {
    if (err instanceof Groq.APIError) {
      this.logger.error(
        `Groq ${model} a echoue (status=${err.status ?? 'stream'}): ${err.message}`,
      );
      return;
    }
    this.logger.error(
      `Groq ${model} a echoue: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async request(
    input: CompleteInput & { model: string },
  ): Promise<ChatLlmResponse> {
    const stream = await this.getSdk().chat.completions.create({
      model: input.model,
      messages: input.messages.map(toGroqMessage),
      tools: input.tools as unknown as ChatCompletionTool[],
      tool_choice: input.toolChoice ?? 'auto',
      max_tokens: CHAT_LIMITS.maxOutputTokens,
      temperature: 0.2,
      stream: true,
    });

    let model = input.model;
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;
    const toolCalls: ChatToolCall[] = [];

    for await (const chunk of stream) {
      model = chunk.model || model;

      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        content += delta.content;
        input.onToken?.(delta.content);
      }
      for (const call of delta?.tool_calls ?? []) {
        const slot = (toolCalls[call.index] ??= {
          id: '',
          name: '',
          arguments: '',
        });
        if (call.id) slot.id = call.id;
        if (call.function?.name) slot.name = call.function.name;
        if (call.function?.arguments) slot.arguments += call.function.arguments;
      }

      // Groq sends usage — and a possible early-stop reason — in the final
      // chunk only.
      if (chunk.x_groq?.error) {
        throw new GroqStreamInterruptedError(chunk.x_groq.error);
      }
      const usage = chunk.x_groq?.usage;
      if (usage) {
        inputTokens = usage.prompt_tokens ?? 0;
        outputTokens = usage.completion_tokens ?? 0;
      }
    }

    const completedCalls = toolCalls.filter((call) => call.id && call.name);

    return {
      model,
      message: {
        role: 'assistant',
        content,
        ...(completedCalls.length > 0 ? { toolCalls: completedCalls } : {}),
      },
      usage: { inputTokens, outputTokens },
    };
  }

  private getSdk(): Groq {
    if (this.sdk) return this.sdk;
    const apiKey = this.config.get<string>('GROQ_API_KEY', '');
    if (!apiKey) {
      throw new ServiceUnavailableException('GROQ_API_KEY manquante');
    }
    this.sdk = new Groq({
      apiKey,
      timeout: CHAT_LIMITS.groqTimeoutMs,
      maxRetries: 0,
    });
    return this.sdk;
  }
}

function shouldFallback(err: unknown): boolean {
  if (err instanceof GroqStreamInterruptedError) return true;
  if (err instanceof Groq.APIUserAbortError) return false;
  if (err instanceof Groq.APIConnectionError) return true;
  if (err instanceof Groq.APIError) {
    // status undefined = the failure happened inside the SSE stream (free
    // tier cutting a generation) — a different model is worth a retry.
    if (err.status === undefined) return true;
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

function toServiceError(err: unknown): Error {
  if (err instanceof ServiceUnavailableException) return err;
  if (err instanceof GroqStreamInterruptedError) {
    return new ServiceUnavailableException(err.message);
  }
  if (err instanceof Groq.APIConnectionError) {
    return new ServiceUnavailableException('Groq indisponible (connexion)');
  }
  if (err instanceof Groq.APIError) {
    return new ServiceUnavailableException(
      `Groq indisponible (${err.status ?? 'stream interrompu'})`,
    );
  }
  return new ServiceUnavailableException('Groq indisponible');
}

function toGroqMessage(message: ChatLlmMessage): ChatCompletionMessageParam {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      content: message.content,
      tool_call_id: message.toolCallId ?? '',
    };
  }

  if (message.role === 'assistant') {
    return {
      role: 'assistant',
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

  if (message.role === 'system') {
    return { role: 'system', content: message.content };
  }

  return { role: 'user', content: message.content };
}
