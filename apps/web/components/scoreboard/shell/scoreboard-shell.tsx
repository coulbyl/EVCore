import { cn } from "@evcore/ui/cn";
import { scoreboardFontVariables } from "@/app/fonts/scoreboard-fonts";
import { BottomTabs } from "./bottom-tabs";
import { SideRail } from "./side-rail";

/**
 * La coquille du tableau d'affichage (13-style.md, 10-transverse.md § 4).
 *
 * Elle pose `.scoreboard` (les couleurs, app/styles/scoreboard.css) et les
 * deux polices sur sa racine : tout ce qui est dessous prend le nouveau
 * monde, rien au-dessus ne change. Téléphone : contenu puis barre d'onglets
 * fixée en bas. À partir de 1024 px : colonne gauche, puis une colonne de
 * contenu bornée (pas de ligne qui s'étire sur un grand écran).
 */
export function ScoreboardShell({
  railFooter,
  skipLinkLabel,
  children,
}: {
  railFooter: React.ReactNode;
  skipLinkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        scoreboardFontVariables,
        "scoreboard min-h-dvh font-text antialiased lg:flex",
      )}
    >
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2.5 text-body font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {skipLinkLabel}
      </a>
      <SideRail footer={railFooter} />
      <div className="flex min-w-0 flex-1 justify-center">
        <main
          id="contenu"
          className="w-full max-w-[40rem] pb-[calc(3.5rem+env(safe-area-inset-bottom)+1.5rem)] lg:pb-10"
        >
          {children}
        </main>
      </div>
      <BottomTabs />
    </div>
  );
}
