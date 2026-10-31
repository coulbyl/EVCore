import { CalendarDays, ChartColumn, Shirt, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Les quatre onglets du joueur (docs/refonte-ui/02-les-4-onglets.md).
 * L'ordre est celui de la barre du bas et de la colonne gauche.
 *
 * Le cinquième, « Admin », n'existe que pour un compte admin et arrive avec
 * l'admin (15-todo.md, G1) : il s'ajoute ici, pas dans les composants.
 */
export type PlayerTabKey = "today" | "matches" | "results" | "me";

export type PlayerTab = {
  key: PlayerTabKey;
  href: `/${string}`;
  icon: LucideIcon;
};

export const PLAYER_TABS: readonly PlayerTab[] = [
  { key: "today", href: "/today", icon: CalendarDays },
  // lucide n'a pas de ballon de football : le maillot se lit « équipes ».
  { key: "matches", href: "/matches", icon: Shirt },
  { key: "results", href: "/results", icon: ChartColumn },
  { key: "me", href: "/me", icon: UserRound },
] as const;

/** Un onglet est actif sur sa route et sur toutes ses sous-routes. */
export function isTabActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** L'initiale affichée à la place d'un avatar (09-moi.md § 5). */
export function initialOf(user: {
  fullName: string;
  username: string | null;
  email: string;
}): string {
  const source = user.fullName.trim() || user.username?.trim() || user.email;
  return source.charAt(0).toLocaleUpperCase("fr") || "?";
}
