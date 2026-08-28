import Groq from "groq-sdk";
import type { Config } from "../config";

export function createGroqClient(config: Config): Groq {
  return new Groq({ apiKey: config.groqApiKey });
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
    model: config.groqModel,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("Groq returned an empty completion");
  }
  return content;
}
