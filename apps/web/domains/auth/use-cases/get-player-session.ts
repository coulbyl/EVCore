import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import { ApiError } from "@/lib/api/shared";
import type { AuthSession } from "../types/auth";

/**
 * La session du joueur, et ce qui l'empêche d'en avoir une.
 *
 * - `signed-in` : la session.
 * - `signed-out` : le serveur répond qu'il n'y a pas de session (401, 403) ;
 *   on renvoie vers la connexion.
 * - `unavailable` : le serveur ne répond pas (réseau, 5xx). Ce n'est pas une
 *   session expirée : on montre la maintenance, pas l'écran de connexion.
 */
export type PlayerSessionResult =
  | { status: "signed-in"; session: AuthSession }
  | { status: "signed-out" }
  | { status: "unavailable" };

async function readPlayerSession(): Promise<PlayerSessionResult> {
  try {
    const payload = await serverApiRequest<{ session: AuthSession }>(
      "/auth/me",
    );
    return { status: "signed-in", session: payload.session };
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.status >= 400 &&
      error.status < 500
    ) {
      return { status: "signed-out" };
    }
    return { status: "unavailable" };
  }
}

/**
 * Lue une seule fois par requête pour tout l'arbre du joueur : la mise en
 * page et le bandeau de chaque écran l'appellent, React la mémorise pour la
 * durée du rendu (budget : une lecture de session par requête,
 * docs/refonte-ui/16-performance-et-qualite.md § 2).
 */
export const getPlayerSession = cache(readPlayerSession);
