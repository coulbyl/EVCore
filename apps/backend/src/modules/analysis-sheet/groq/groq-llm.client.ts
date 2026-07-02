import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import { ANALYSIS_SHEET_MODELS } from '../analysis-sheet.constants';
import type { LlmClient, LlmMessage, LlmResponse } from './groq-llm.types';

type CompleteInput = Parameters<LlmClient['complete']>[0];

const GROQ_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_TOKENS = 2048;

@Injectable()
export class GroqLlmClient implements LlmClient {
  private readonly logger = new Logger(GroqLlmClient.name);
  private sdk: Groq | null = null;

  constructor(private readonly config: ConfigService) {}

  async complete(input: CompleteInput): Promise<LlmResponse> {
    const model =
      input.model ??
      this.config.get<string>('CHAT_GROQ_MODEL', ANALYSIS_SHEET_MODELS.scout);

    try {
      return await this.request(input.messages, model);
    } catch (err: unknown) {
      this.logError(model, err);
      if (model !== ANALYSIS_SHEET_MODELS.light && shouldFallback(err)) {
        try {
          return await this.request(
            input.messages,
            ANALYSIS_SHEET_MODELS.light,
          );
        } catch (fallbackErr: unknown) {
          this.logError(ANALYSIS_SHEET_MODELS.light, fallbackErr);
          throw toServiceError(fallbackErr);
        }
      }
      throw toServiceError(err);
    }
  }

  private logError(model: string, err: unknown): void {
    if (err instanceof Groq.APIError) {
      this.logger.error(
        `Groq ${model} a echoue (status=${err.status ?? 'unknown'}): ${err.message}`,
      );
      return;
    }
    this.logger.error(
      `Groq ${model} a echoue: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  private async request(
    messages: LlmMessage[],
    model: string,
  ): Promise<LlmResponse> {
    const response = await this.getSdk().chat.completions.create({
      model,
      messages: messages.map(toGroqMessage),
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.2,
      stream: false,
    });

    const content = response.choices[0]?.message.content ?? '';

    return {
      content,
      model: response.model || model,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
      },
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
      timeout: GROQ_TIMEOUT_MS,
      maxRetries: 0,
    });
    return this.sdk;
  }
}

function shouldFallback(err: unknown): boolean {
  if (err instanceof Groq.APIUserAbortError) return false;
  if (err instanceof Groq.APIConnectionError) return true;
  if (err instanceof Groq.APIError) {
    if (err.status === undefined) return true;
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

function toServiceError(err: unknown): Error {
  if (err instanceof ServiceUnavailableException) return err;
  if (err instanceof Groq.APIConnectionError) {
    return new ServiceUnavailableException('Groq indisponible (connexion)');
  }
  if (err instanceof Groq.APIError) {
    return new ServiceUnavailableException(
      `Groq indisponible (${err.status ?? 'erreur'})`,
    );
  }
  return new ServiceUnavailableException('Groq indisponible');
}

function toGroqMessage(message: LlmMessage): ChatCompletionMessageParam {
  if (message.role === 'system') {
    return { role: 'system', content: message.content };
  }
  return { role: 'user', content: message.content };
}
