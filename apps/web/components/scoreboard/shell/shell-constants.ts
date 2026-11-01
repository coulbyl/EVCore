import {
  CalendarDays,
  ChartColumn,
  Cpu,
  Gauge,
  MessageCircle,
  Settings,
  Shirt,
  UserRound,
  UsersRound,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Les quatre onglets du joueur (docs/refonte-ui/02-les-4-onglets.md).
 * L'ordre est celui de la barre du bas et de la colonne gauche.
 *
 * Un compte admin a sa propre barre sur téléphone (`ADMIN_BAR_KEYS`, et
 * « Plus » pour le reste) et une section de plus dans la colonne gauche.
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

export type AdminSectionKey =
  | "home"
  | "engine"
  | "players"
  | "messages"
  | "exploitation"
  | "settings";

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
  { key: "messages", href: "/admin/messages", icon: MessageCircle },
  { key: "exploitation", href: "/admin/exploitation", icon: Wrench },
  { key: "settings", href: "/admin/settings", icon: Settings },
] as const;

/**
 * An admin's bar on a phone: its four screens, then « Plus » for the rest
 * (Exploitation, Réglages and the player's tabs). The rail shows them all.
 */
export const ADMIN_BAR_KEYS: readonly AdminSectionKey[] = [
  "home",
  "engine",
  "players",
  "messages",
];

/** Under « Plus »: the admin's other screens. */
export const ADMIN_MORE_KEYS: readonly AdminSectionKey[] = [
  "exploitation",
  "settings",
];

/** An admin section is active on its route; the home on /admin only. */
export function isAdminSectionActive(pathname: string, href: string): boolean {
  return href === "/admin"
    ? pathname === "/admin"
    : isTabActive(pathname, href);
}

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
