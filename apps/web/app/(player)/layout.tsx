import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { InAppHistoryTracker } from "@/components/scoreboard/sheet/in-app-history";
import { BandActions } from "@/components/scoreboard/shell/band-actions";
import { getUnreadCount } from "@/domains/notifications/use-cases/get-notifications";
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
import { PlayerTextsProvider } from "@/components/scoreboard/text/player-texts";
import { pickPlayerTexts } from "@/components/scoreboard/text/player-texts-constants";
import { TicketDock } from "@/components/scoreboard/ticket/ticket-dock";
import { activePauseEnd } from "@/domains/auth/types/auth";
import { displayLocaleOf } from "@/helpers/scoreboard-format";

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
  const [result, t, timeZone, messages, locale] = await Promise.all([
    getPlayerSession(),
    getTranslations("shell"),
    getPlayerTimeZone(),
    getMessages(),
    getLocale(),
  ]);
  // Les seuls textes que ses composants client affichent (C0).
  const texts = pickPlayerTexts(messages);

  // Le serveur ne répond pas : la maintenance, pas la connexion.
  if (result.status === "unavailable") {
    return (
      <PlayerTextsProvider texts={texts}>
        <MaintenanceScreen />
      </PlayerTextsProvider>
    );
  }
  // Le proxy ne voit que la présence du cookie : une session expirée ou
  // révoquée arrive ici, et repart vers la connexion avec l'écran demandé.
  if (result.status === "signed-out") {
    const requested = (await headers()).get(REQUESTED_PATH_HEADER);
    redirect(loginPathFor(safeNextPath(requested)));
  }
  const { session } = result;
  const unread = await getUnreadCount();

  return (
    <PlayerTextsProvider texts={texts}>
      <ScoreboardShell
        skipLinkLabel={t("skipToContent")}
        legalText={t("legal")}
        sheet={sheet}
        dock={
          <TicketDock
            locale={displayLocaleOf(locale)}
            paused={activePauseEnd(session.user.pausedUntil) !== null}
          />
        }
        railFooter={
          <BandActions
            initial={initialOf(session.user)}
            unread={unread}
            labels={{
              notifications: t("notifications"),
              me: t("tabs.me"),
              unread: t.raw("unread") as string,
            }}
          />
        }
      >
        <TimeZoneSync cookieName={TIME_ZONE_COOKIE} serverTimeZone={timeZone} />
        <InAppHistoryTracker />
        {children}
      </ScoreboardShell>
    </PlayerTextsProvider>
  );
}
