import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { InAppHistoryTracker } from "@/components/scoreboard/sheet/in-app-history";
import { BandActions } from "@/components/scoreboard/shell/band-actions";
import { ScoreboardShell } from "@/components/scoreboard/shell/scoreboard-shell";
import { TimeZoneSync } from "@/components/scoreboard/shell/time-zone-sync";
import { MaintenanceScreen } from "@/components/scoreboard/states/maintenance-screen";
import {
  TIME_ZONE_COOKIE,
  getPlayerTimeZone,
} from "@/domains/preferences/get-player-time-zone";
import { initialOf } from "@/components/scoreboard/shell/shell-constants";
import {
  REQUESTED_PATH_HEADER,
  loginPathFor,
} from "@/domains/auth/routing/auth-routing";
import { safeNextPath } from "@/domains/auth/helpers/safe-next-path";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";

/**
 * Les quatre onglets du joueur dans la coquille du tableau d'affichage.
 * Construits à côté des anciens écrans (/dashboard/*), qui restent en place
 * jusqu'au commit de bascule (docs/refonte-ui/15-todo.md, C19).
 */
export default async function PlayerLayout({
  children,
  sheet,
}: {
  children: React.ReactNode;
  /** La feuille ouverte (fente parallèle `@sheet`), ou rien. */
  sheet: React.ReactNode;
}) {
  const [result, t, timeZone] = await Promise.all([
    getPlayerSession(),
    getTranslations("shell"),
    getPlayerTimeZone(),
  ]);

  // Le serveur ne répond pas : la maintenance, pas la connexion.
  if (result.status === "unavailable") {
    return <MaintenanceScreen />;
  }
  // Le proxy ne voit que la présence du cookie : une session expirée ou
  // révoquée arrive ici, et repart vers la connexion avec l'écran demandé.
  if (result.status === "signed-out") {
    const requested = (await headers()).get(REQUESTED_PATH_HEADER);
    redirect(loginPathFor(safeNextPath(requested)));
  }
  const { session } = result;

  return (
    <ScoreboardShell
      skipLinkLabel={t("skipToContent")}
      sheet={sheet}
      railFooter={
        <BandActions
          initial={initialOf(session.user)}
          labels={{ notifications: t("notifications"), me: t("tabs.me") }}
        />
      }
    >
      <TimeZoneSync cookieName={TIME_ZONE_COOKIE} serverTimeZone={timeZone} />
      <InAppHistoryTracker />
      {children}
    </ScoreboardShell>
  );
}
