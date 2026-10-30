"use client";

import { usePlayerText } from "../text/player-texts";
// clsx alone: no class comes from outside, nothing for tailwind-merge to
// resolve, and it weighed 8.5 kio of the player's JS (C0).
import { clsx as cn } from "clsx";
import { scoreboardFontVariables } from "@/app/fonts/scoreboard-fonts";
import { LegalLine } from "../shell/legal-line";

/**
 * Le serveur ne répond pas (10-transverse.md § 2) : une page, pas un onglet,
 * et surtout pas l'écran de connexion, qui ferait croire au joueur que sa
 * session a expiré. Une issue : réessayer.
 *
 * Elle se rend à la place de la coquille, donc elle pose elle-même
 * `.scoreboard` et les polices.
 */
export function MaintenanceScreen() {
  const t = usePlayerText("scoreboard.states");
  const shell = usePlayerText("shell");
  const brand = shell("brand");

  return (
    <div
      className={cn(
        scoreboardFontVariables,
        "scoreboard flex min-h-dvh flex-col font-text antialiased",
      )}
    >
      <header className="bg-band px-4 pb-3.5 text-band-foreground pt-[max(1rem,env(safe-area-inset-top))] dark:border-b dark:border-band-rule">
        <div className="flex min-h-11 items-center">
          <span className="score text-title font-bold">{brand}</span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="score text-title font-semibold">
          {t("maintenanceTitle")}
        </h1>
        <p className="max-w-[28rem] text-body text-muted-foreground">
          {t("maintenanceBody")}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 inline-flex min-h-12 items-center rounded-[0.625rem] bg-primary px-7 text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {t("retry")}
        </button>
      </main>
      <LegalLine text={shell("legal")} />
    </div>
  );
}
