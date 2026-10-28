import { clientApiRequest } from "@/lib/api/client-api";

export type ProductEvent =
  | {
      type: "NOTIFICATION_OPENED";
      notificationType: "MORNING_BRIEF" | "WEEKLY_STATEMENT";
    }
  | { type: "TOUR_COMPLETED" };

/**
 * Enregistre une action produit (mesure interne, sans tiers — lot 4). Sans
 * attente ni message d'erreur : une mesure perdue ne gêne jamais le joueur.
 */
export function recordProductEvent(event: ProductEvent): void {
  void clientApiRequest("/events", { method: "POST", body: event }).catch(
    () => undefined,
  );
}
