import { clientApiRequest } from "@/lib/api/client-api";

export async function declareFixtureResult(
  fixtureId: string,
  body: {
    homeScore: number;
    awayScore: number;
    homeHtScore?: number;
    awayHtScore?: number;
  },
): Promise<void> {
  await clientApiRequest<void>(`/adjustment/fixture/${fixtureId}/result`, {
    method: "PATCH",
    body,
    fallbackErrorMessage: "Impossible de declarer le resultat du match.",
  });
}
