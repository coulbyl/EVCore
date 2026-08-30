import Groq from "groq-sdk";
import OpenAI from "openai";
import type { Logger } from "pino";
import type { Config, LlmProvider } from "../config";

/** The minimal chat-completions shape every provider's client is used
 * through — lets requestVantageCompletion (and research.ts) stay
 * provider-agnostic instead of depending on either SDK's concrete class. */
export type ChatCompletionClient = {
  chat: {
    completions: {
      create(params: {
        model: string;
        temperature?: number;
        response_format?: { type: "json_object" };
        messages: { role: "system" | "user"; content: string }[];
      }): Promise<{
        choices: { message?: { content?: string | null } | null }[];
      }>;
    };
  };
};

export type LlmClient = {
  provider: LlmProvider;
  client: ChatCompletionClient;
  model: string;
};

/** Every configured provider, ready to call, in fallback order: the primary
 * first, then each `LLM_PROVIDER_FALLBACKS` entry. */
export type LlmClients = {
  primary: LlmClient;
  fallbacks: LlmClient[];
};

/** The client for a specific provider, wherever it's configured — primary
 * or fallback. Used by research.ts: situational research is a Groq-only
 * capability (native `groq/compound` web search), but that shouldn't
 * require Groq to be the *primary* verdict provider — a real prod
 * configuration (2026-08-30) runs `LLM_PROVIDER=cerebras` (the recommended
 * workaround for Groq's 8000 TPM cap) with `LLM_PROVIDER_FALLBACKS=groq,
 * together`. The pre-2026-08-30 gate (`config.llmProvider !== "groq"`)
 * missed this entirely: it only ever checked the primary, so research
 * silently no-op'd on every fixture despite `VANTAGE_ENABLE_RESEARCH=true`
 * and a perfectly usable Groq client sitting in `clients.fallbacks`. */
export function findProviderClient(
  clients: LlmClients,
  provider: LlmProvider,
): LlmClient | null {
  if (clients.primary.provider === provider) return clients.primary;
  return clients.fallbacks.find((f) => f.provider === provider) ?? null;
}

/** groq-sdk's client is Groq-specific, not a generic OpenAI-compatible one,
 * despite exposing a `baseURL` override: it unconditionally posts to
 * `/openai/v1/chat/completions` (see groq-sdk/resources/chat/completions.js)
 * — that path segment is Groq's own routing, not a shared OpenAI-compat
 * convention. Pointing it at Cerebras with `baseURL:
 * "https://api.cerebras.ai/v1"` therefore hit
 * `https://api.cerebras.ai/v1/openai/v1/chat/completions` and 404'd in prod
 * (2026-08-28). Only Groq itself gets groq-sdk; every other provider gets
 * the actual `openai` package, whose client posts to plain
 * `/chat/completions` with no hardcoded prefix — the real generic
 * OpenAI-compatible client. */
function buildClient(
  provider: LlmProvider,
  apiKey: string,
  baseUrl: string | undefined,
): ChatCompletionClient {
  if (provider === "groq") return new Groq({ apiKey });
  return new OpenAI({ apiKey, baseURL: baseUrl });
}

export function createLlmClients(config: Config): LlmClients {
  return {
    primary: {
      provider: config.llmProvider,
      client: buildClient(
        config.llmProvider,
        config.llmApiKey,
        config.llmBaseUrl,
      ),
      model: config.llmModel,
    },
    fallbacks: config.llmFallbackProviders.map((p) => ({
      provider: p.provider,
      client: buildClient(p.provider, p.apiKey, p.baseUrl),
      model: p.model,
    })),
  };
}

/** Whether this failure is worth retrying on the next configured provider —
 * capacity/availability problems, not a problem the next provider would
 * reproduce (a malformed prompt, an invalid API key). Duck-typed on
 * `.status` rather than `instanceof Groq.APIError`/`instanceof
 * OpenAI.APIError` so it works the same regardless of which SDK actually
 * threw — both are Stainless-generated API error classes that always set
 * `.status` (undefined for a connection/timeout failure, the HTTP status
 * otherwise). Covers: rate limits (429), server-side errors (5xx), and
 * connection failures/timeouts (status undefined). Excludes 4xx
 * configuration errors (401 bad key, 400 bad request, 404 bad route) —
 * those need a human, not a fallback. */
function isRetryableProviderError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("status" in err)) {
    return false;
  }
  const status = (err as { status?: unknown }).status;
  if (status === undefined) return true;
  return typeof status === "number" && (status === 429 || status >= 500);
}

/** Raw completion call — the caller owns Zod validation of the result.
 * `temperature: 0` per EVCORE.md §14.3 (reproducibility guardrail): every
 * VANTAGE call must be replayable from its logged input.
 *
 * Tries `clients.primary` first, then each fallback in order, only moving
 * on when the failure looks transient (see isRetryableProviderError) — a
 * non-retryable error (bad prompt, bad key) fails fast instead of burning
 * through every configured provider for nothing. */
export async function requestVantageCompletion(
  clients: LlmClients,
  systemPrompt: string,
  userPrompt: string,
  logger: Logger,
): Promise<string> {
  const attempts = [clients.primary, ...clients.fallbacks];

  for (const [index, attempt] of attempts.entries()) {
    const isLastAttempt = index === attempts.length - 1;
    try {
      const completion = await attempt.client.chat.completions.create({
        model: attempt.model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error(`${attempt.provider} returned an empty completion`);
      }
      if (index > 0) {
        logger.info(
          { provider: attempt.provider },
          "vantage: verdict served by a fallback provider",
        );
      }
      return content;
    } catch (err) {
      if (isLastAttempt || !isRetryableProviderError(err)) throw err;
      logger.warn(
        {
          provider: attempt.provider,
          nextProvider: attempts[index + 1]?.provider,
          err,
        },
        "vantage: provider call failed, falling back to the next configured provider",
      );
    }
  }

  // Unreachable — `attempts` always has at least `clients.primary`, and the
  // loop above always either returns or throws.
  throw new Error("requestVantageCompletion: no provider attempted");
}
