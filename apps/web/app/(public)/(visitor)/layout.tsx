import { clsx } from "clsx";
import { scoreboardFontVariables } from "@/app/fonts/scoreboard-fonts";
import "../../(player)/player.css";

/**
 * Ce qu'un visiteur voit sans compte (11 § 1) : la landing et /resultats,
 * dans le style du tableau d'affichage, une colonne bornée, sans onglets.
 */
export default function VisitorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        scoreboardFontVariables,
        "scoreboard min-h-dvh bg-background font-text text-foreground antialiased",
      )}
    >
      {/* The ink band spans the screen; the band's content, the page and
          its footer keep one column of 40 rem at most (each sets it). */}
      <div className="flex min-h-dvh w-full flex-col">{children}</div>
    </div>
  );
}
