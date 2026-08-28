import Groq from "groq-sdk";
import type { Logger } from "pino";
import type { Config } from "../config";

type LlmClient = {
  provider: string;
  client: Groq;
  model: string;
};

/** Every configured provider, ready to call, in fallback order: the primary
 * first, then each `LLM_PROVIDER_FALLBACKS` entry. groq-sdk's client is used
 * for every provider, not just Groq itself — it accepts a `baseURL`
 * override and none of the request/response shape used below
 * (chat.completions.create, response_format json_object) is Groq-specific. */
export type LlmClients = {
  primary: LlmClient;
  fallbacks: LlmClient[];
};

export function createLlmClients(config: Config): LlmClients {
  return {
    primary: {
      provider: config.llmProvider,
      client: new Groq({ apiKey: config.llmApiKey, baseURL: config.llmBaseUrl }),
      model: config.llmModel,
    },
    fallbacks: config.llmFallbackProviders.map((p) => ({
      provider: p.provider,
      client: new Groq({ apiKey: p.apiKey, baseURL: p.baseUrl }),
      model: p.model,
    })),
  };
}

/** Whether this failure is worth retrying on the next configured provider —
 * capacity/availability problems, not a problem the next provider would
 * reproduce (a malformed prompt, an invalid API key). Covers: rate limits
 * (429 — the Groq TPM ceiling this fallback exists for), server-side errors
 * (5xx), and connection failures/timeouts (groq-sdk reports these as an
 * APIError with `status: undefined`). Excludes 4xx configuration errors
 * (401 bad key, 400 bad request) — those need a human, not a fallback. */
function isRetryableProviderError(err: unknown): boolean {
  if (!(err instanceof Groq.APIError)) return false;
  return err.status === undefined || err.status === 429 || err.status >= 500;
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
        { provider: attempt.provider, nextProvider: attempts[index + 1]?.provider, err },
        "vantage: provider call failed, falling back to the next configured provider",
      );
    }
  }

  // Unreachable — `attempts` always has at least `clients.primary`, and the
  // loop above always either returns or throws.
  throw new Error("requestVantageCompletion: no provider attempted");
}
