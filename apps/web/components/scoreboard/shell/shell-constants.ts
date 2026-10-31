import {
  CalendarDays,
  ChartColumn,
  Gauge,
  Settings,
  Shirt,
  UserRound,
  UsersRound,
  Cpu,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Les quatre onglets du joueur (docs/refonte-ui/02-les-4-onglets.md).
 * L'ordre est celui de la barre du bas et de la colonne gauche.
 *
 * Le cinquième, « Admin », n'existe que pour un compte admin (12-admin.md,
 * maquettes AdminMobile, Admin) : `tabsFor` l'ajoute, les composants ne le
 * connaissent pas.
 */
export type PlayerTabKey = "today" | "matches" | "results" | "me" | "admin";

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

export const ADMIN_TAB: PlayerTab = {
  key: "admin",
  href: "/admin",
  icon: Gauge,
};

/** The bar and the rail: the four tabs, and « Admin » for an admin. */
export function tabsFor(admin: boolean): readonly PlayerTab[] {
  return admin ? [...PLAYER_TABS, ADMIN_TAB] : PLAYER_TABS;
}

export type AdminSectionKey = "home" | "engine" | "players" | "settings";

/**
 * The admin's three screens and its settings (12-admin.md § 0): chips in
 * the band on a phone, a section of the rail on a wide screen.
 */
export const ADMIN_SECTIONS: readonly {
  key: AdminSectionKey;
  href: `/admin${string}`;
  icon: LucideIcon;
}[] = [
  { key: "home", href: "/admin", icon: Gauge },
  { key: "engine", href: "/admin/engine", icon: Cpu },
  { key: "players", href: "/admin/players", icon: UsersRound },
  { key: "settings", href: "/admin/settings", icon: Settings },
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
