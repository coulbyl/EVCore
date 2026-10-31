import type { Metadata } from "next";
import Link from "next/link";
import { PlayerBand } from "@/components/scoreboard/shell/player-band";
import { assertDevOnly, devOnlyMetadata } from "../dev-only";
import { ViewportProbe } from "./viewport-probe";

export const metadata: Metadata = {
  title: "Relevé de l'écran — vitrine",
  ...devOnlyMetadata,
};

/**
 * What a real phone's browser covers at the bottom of the page (15-todo.md,
 * « Feuille courte coupée en bas »). A simulator draws its own bar over the
 * page and sees no viewport change: only a real phone settles where a fixed
 * element may sit. The ruler reads in CSS pixels up from the bottom edge
 * where `position: fixed; bottom: 0` lands; the lowest graduation still
 * visible is how much the browser hides.
 */
export default function ViewportProbePage() {
  assertDevOnly();
  return (
    <>
      <PlayerBand />
      <div className="flex flex-col gap-4 px-4 pt-4 lg:px-6">
        <ol className="flex list-decimal flex-col gap-1 ps-5 text-body">
          <li>
            Note la plus petite graduation lisible de la règle, en bas à gauche,
            et fais une capture.
          </li>
          <li>
            Fais défiler vers le bas pour replier la barre du navigateur, puis
            recommence.
          </li>
          <li>
            Ouvre la feuille de démonstration et regarde si « Suivre » passe
            sous la barre.
          </li>
        </ol>
        <Link
          href="/dev/components/sheet"
          className="flex h-12 items-center justify-center rounded-[0.625rem] bg-primary text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Ouvrir la feuille de démonstration
        </Link>
        <ViewportProbe />
      </div>
    </>
  );
}
