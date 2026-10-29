import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BandActions } from "@/components/scoreboard/shell/band-actions";
import { ScoreboardShell } from "@/components/scoreboard/shell/scoreboard-shell";
import { initialOf } from "@/components/scoreboard/shell/shell-constants";
import { getPlayerSession } from "@/domains/auth/use-cases/get-player-session";

/**
 * Les quatre onglets du joueur dans la coquille du tableau d'affichage.
 * Construits à côté des anciens écrans (/dashboard/*), qui restent en place
 * jusqu'au commit de bascule (docs/refonte-ui/15-todo.md, C19).
 */
export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, t] = await Promise.all([
    getPlayerSession(),
    getTranslations("shell"),
  ]);

  if (!session) {
    redirect("/auth/login");
  }

  return (
    <ScoreboardShell
      skipLinkLabel={t("skipToContent")}
      railFooter={
        <BandActions
          initial={initialOf(session.user)}
          labels={{ notifications: t("notifications"), me: t("tabs.me") }}
        />
      }
    >
      {children}
    </ScoreboardShell>
  );
}
