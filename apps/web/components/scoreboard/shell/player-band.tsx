import { getTranslations } from "next-intl/server";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { getUnreadCount } from "@/domains/notifications/use-cases/get-notifications";
import { BandActions } from "./band-actions";
import { ScreenBand } from "./screen-band";
import { initialOf } from "./shell-constants";

/**
 * Le bandeau d'un écran du joueur : la marque et les actions du joueur
 * connecté, puis ce que l'écran y met (`children`).
 */
export async function PlayerBand({ children }: { children?: React.ReactNode }) {
  const [result, t, unread] = await Promise.all([
    getPlayerSession(),
    getTranslations("shell"),
    getUnreadCount(),
  ]);

  return (
    <ScreenBand
      brand={t("brand")}
      actions={
        <BandActions
          initial={
            result.status === "signed-in" ? initialOf(result.session.user) : "?"
          }
          avatarUrl={
            result.status === "signed-in" ? result.session.user.avatarUrl : null
          }
          unread={unread}
          labels={{
            notifications: t("notifications"),
            me: t("tabs.me"),
            unread: t.raw("unread") as string,
          }}
        />
      }
    >
      {children}
    </ScreenBand>
  );
}
