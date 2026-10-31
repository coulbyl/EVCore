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
      <div className="mx-auto flex min-h-dvh w-full max-w-[40rem] flex-col">
        {children}
      </div>
    </div>
  );
}
