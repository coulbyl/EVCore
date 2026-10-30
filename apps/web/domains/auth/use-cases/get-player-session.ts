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
 * - `unavailable` : le serveur ne répond pas ou pas sur la session (réseau,
 *   5xx, 429). Ce n'est pas une session expirée : on montre la maintenance,
 *   pas l'écran de connexion.
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
    // 401 et 403 seulement : un 429 (limite de débit) ou un 404 ne dit rien
    // de la session, et renvoyer le joueur à la connexion lui ferait croire
    // qu'il a été déconnecté.
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
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
