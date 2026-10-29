import { getTranslations } from "next-intl/server";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";
import { BandActions } from "./band-actions";
import { ScreenBand } from "./screen-band";
import { initialOf } from "./shell-constants";

/**
 * Le bandeau d'un écran du joueur : la marque et les actions du joueur
 * connecté, puis ce que l'écran y met (`children`).
 */
export async function PlayerBand({ children }: { children?: React.ReactNode }) {
  const [session, t] = await Promise.all([
    getPlayerSession(),
    getTranslations("shell"),
  ]);

  return (
    <ScreenBand
      brand={t("brand")}
      actions={
        <BandActions
          initial={session ? initialOf(session.user) : "?"}
          labels={{ notifications: t("notifications"), me: t("tabs.me") }}
        />
      }
    >
      {children}
    </ScreenBand>
  );
}
