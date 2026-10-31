/**
 * Les anciennes adresses du joueur et l'écran qui les remplace
 * (docs/refonte-ui/11-public.md § 8). Une seule table : le layout du
 * tableau de bord la lit depuis le commit de bascule (15-todo.md, C19).
 *
 * L'admin garde /dashboard jusqu'à sa propre refonte (12-admin.md, PR 2).
 */
const RETIRED_ROUTES: readonly { from: string; to: string }[] = [
  // Accueil et Coupons : les coupons du jour sont sur Aujourd'hui.
  { from: "/dashboard/coupons", to: "/today" },
  // Décisions et la fiche de match : Matchs.
  { from: "/dashboard/decisions", to: "/matches" },
  { from: "/dashboard/fixtures", to: "/matches" },
  // Avis IA et Mesures historiques : une ligne de Résultats (08 § 1).
  { from: "/dashboard/arbitrage", to: "/results" },
  { from: "/dashboard/track-record", to: "/results" },
  // Mes coupons et Suivi de mise : Moi (coupons suivis, 09 § 1).
  { from: "/dashboard/bet-slips", to: "/me" },
  { from: "/dashboard/bankroll", to: "/me" },
  // Formation et Glossaire : l'Aide de Moi (09 § 3).
  { from: "/dashboard/formation", to: "/me/help" },
  { from: "/dashboard/glossaire", to: "/me/help" },
  // Inbox : Messages, dans Moi (09 § 2).
  { from: "/dashboard/inbox", to: "/me/messages" },
  // Compte, ses cinq onglets compris : dans Moi (09 § 5).
  { from: "/dashboard/params", to: "/me/account" },
  // La cloche sans onglets (09 § 6).
  { from: "/dashboard/notifications", to: "/notifications" },
];

/** Tout le reste de /dashboard est l'admin : un joueur repart d'Aujourd'hui. */
const DEFAULT_TARGET = "/today";

function isUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Où envoyer un joueur qui ouvre une ancienne adresse de /dashboard ; null
 * pour l'admin et pour toute adresse hors de /dashboard.
 */
export function retiredRouteTarget(
  pathname: string,
  role: "ADMIN" | "OPERATOR",
): string | null {
  if (role === "ADMIN" || !isUnder(pathname, "/dashboard")) return null;
  const match = RETIRED_ROUTES.find(({ from }) => isUnder(pathname, from));
  return match?.to ?? DEFAULT_TARGET;
}
