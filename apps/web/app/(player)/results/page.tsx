import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shell");
  return { title: `${t("tabs.results")} — EVCore` };
}

/** Coquille seule : le contenu de l'écran arrive en phase C (15-todo.md). */
export default async function Page() {
  const t = await getTranslations("shell");
  return (
    <>
      <PlayerBand />
      <h1 className="sr-only">{t("tabs.results")}</h1>
    </>
  );
}
