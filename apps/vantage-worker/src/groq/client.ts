import Groq from "groq-sdk";
import type { Config } from "../config";

/** Returns an OpenAI-compatible chat-completions client for whichever
 * provider `config.llmProvider` selects (see config.ts's PROVIDER_DEFAULTS).
 * groq-sdk's client is used for every provider, not just Groq itself — it
 * accepts a `baseURL` override and none of the request/response shape used
 * below (chat.completions.create, response_format json_object) is
 * Groq-specific. */
export function createLlmClient(config: Config): Groq {
  return new Groq({ apiKey: config.llmApiKey, baseURL: config.llmBaseUrl });
}

/** Raw completion call — the caller owns Zod validation of the result.
 * `temperature: 0` per EVCORE.md §14.3 (reproducibility guardrail): every
 * VANTAGE call must be replayable from its logged input. */
export async function requestVantageCompletion(
  client: Groq,
  config: Config,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const completion = await client.chat.completions.create({
    model: config.llmModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error(
      `${config.llmProvider} returned an empty completion`,
    );
  }
  return content;
}
