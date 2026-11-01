/**
 * Les anciennes adresses du joueur et l'écran qui les remplace
 * (docs/refonte-ui/11-public.md § 8). Une seule table : le layout du
 * tableau de bord la lit depuis le commit de bascule (15-todo.md, C19).
 *
 * /dashboard n'existe plus (12-admin.md § 0) : l'admin a ses écrans sous
 * /admin, le joueur ses onglets ; chaque ancienne adresse mène à l'écran
 * le plus proche.
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

/**
 * Les adresses de l'admin qui portent un identifiant : il passe tel quel
 * sur le nouvel écran (un lien d'e-mail ou de notification reste bon).
 */
const ADMIN_MOVED: readonly { from: string; to: string }[] = [
  { from: "/dashboard/inbox", to: "/admin/messages" },
  { from: "/dashboard/decisions/match", to: "/admin/matches" },
];

/** Les pages retirées de l'admin et l'écran qui les remplace (12 § 6). */
const ADMIN_RETIRED: readonly { from: string; to: string }[] = [
  // Les outils, rapports et mesures : Moteur ; le reste vit dans le dépôt.
  { from: "/dashboard/audit", to: "/admin/engine" },
  { from: "/dashboard/reports", to: "/admin/engine" },
  { from: "/dashboard/documentation-technique", to: "/admin/engine" },
  { from: "/dashboard/ml", to: "/admin/engine" },
  { from: "/dashboard/performance", to: "/admin/engine" },
  { from: "/dashboard/engine", to: "/admin/engine" },
  { from: "/dashboard/arbitrage", to: "/admin/engine" },
  { from: "/dashboard/track-record", to: "/admin/engine" },
  // Comptes et annonces : Joueurs.
  { from: "/dashboard/users", to: "/admin/players" },
  { from: "/dashboard/announcements", to: "/admin/players/announcements" },
  // Les écrans du joueur, que l'admin a dans ses onglets.
  { from: "/dashboard/coupons", to: "/today" },
  { from: "/dashboard/decisions", to: "/matches" },
  { from: "/dashboard/fixtures", to: "/matches" },
  { from: "/dashboard/params", to: "/me/account" },
  { from: "/dashboard/notifications", to: "/notifications" },
  { from: "/dashboard/updates", to: "/notifications" },
];

function isUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Où envoyer qui ouvre une ancienne adresse de /dashboard ; null pour toute
 * adresse hors de /dashboard.
 */
export function retiredRouteTarget(
  pathname: string,
  role: "ADMIN" | "OPERATOR",
): string | null {
  if (!isUnder(pathname, "/dashboard")) return null;
  if (role === "ADMIN") {
    const moved = ADMIN_MOVED.find(({ from }) => isUnder(pathname, from));
    if (moved) return `${moved.to}${pathname.slice(moved.from.length)}`;
    const match = ADMIN_RETIRED.find(({ from }) => isUnder(pathname, from));
    return match?.to ?? "/admin";
  }
  const match = RETIRED_ROUTES.find(({ from }) => isUnder(pathname, from));
  return match?.to ?? DEFAULT_TARGET;
}
