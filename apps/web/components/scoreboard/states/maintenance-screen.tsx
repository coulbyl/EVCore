import { getTranslations } from "next-intl/server";
// clsx alone: no class comes from outside, nothing for tailwind-merge to
// resolve, and it weighed 8.5 kio of the player's JS (C0).
import { clsx as cn } from "clsx";
import { scoreboardFontVariables } from "@/app/fonts/scoreboard-fonts";
import { LegalLine } from "../shell/legal-line";
import { BrandMark } from "../shell/brand-mark";

/**
 * Le serveur ne répond pas (10-transverse.md § 2) : une page, pas un onglet,
 * et surtout pas l'écran de connexion, qui ferait croire au joueur que sa
 * session a expiré. Une issue : réessayer.
 *
 * Elle se rend à la place de la coquille, donc elle pose elle-même
 * `.scoreboard` et les polices.
 *
 * Rendue côté serveur, sans JavaScript : « Réessayer » est un formulaire
 * qui recharge la page. Composant client, elle pesait 0,6 kio sur toutes
 * les pages du joueur, panne ou pas (C7).
 */
export async function MaintenanceScreen() {
  const [t, shell] = await Promise.all([
    getTranslations("scoreboard.states"),
    getTranslations("shell"),
  ]);
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
          <span className="flex items-center gap-2 score text-title font-bold">
            <BrandMark className="size-6" />
            {brand}
          </span>
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="score text-title font-semibold">
          {t("maintenanceTitle")}
        </h1>
        <p className="max-w-[28rem] text-body text-muted-foreground">
          {t("maintenanceBody")}
        </p>
        <form method="get" className="mt-2">
          <button
            type="submit"
            className="inline-flex min-h-12 items-center rounded-[0.625rem] bg-primary px-7 text-bet font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {t("retry")}
          </button>
        </form>
      </main>
      <LegalLine text={shell("legal")} />
    </div>
  );
}
