import { useTranslations } from "next-intl";
import { clsx as cn } from "clsx";
import { Skeleton } from "./skeleton";

/**
 * La feuille pendant que son contenu arrive : elle monte au toucher, avec
 * son en-tête et des lignes grises. Seulement sur les feuilles interceptées,
 * qui ne servent qu'en naviguant : un premier chargement arrive d'un bloc,
 * sans flux (C0b de la refonte, budget LCP).
 *
 * Du balisage serveur, sans JavaScript : en `loading.tsx`, la vraie `Sheet`
 * (client) serait chargée par chaque onglet dès l'arrivée, +3,6 kio sur
 * Aujourd'hui (budgets du 03/11). Le focus reste sur la ligne touchée, que
 * la vraie feuille prend pour ouvreur ; elle ne rejoue pas la montée en
 * trouvant ce squelette (`data-sheet-skeleton`, `sheet-relay.ts`). Mêmes
 * classes que `Sheet`, pour que rien ne saute.
 */
export function SheetSkeleton({ tone = "plain" }: { tone?: "plain" | "band" }) {
  const t = useTranslations("scoreboard.states");
  const onBand = tone === "band";

  return (
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-50 animate-scrim-in bg-scrim motion-reduce:animate-none lg:hidden"
      />
      <div
        data-sheet-skeleton=""
        aria-busy="true"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-[1.25rem] bg-card text-card-foreground",
          "animate-sheet-up motion-reduce:animate-none",
          "md:mx-auto md:max-w-[34rem]",
          "lg:sticky lg:inset-x-auto lg:top-0 lg:bottom-auto lg:z-auto lg:mx-0 lg:h-dvh lg:max-h-none lg:w-full lg:max-w-none lg:animate-none lg:rounded-none lg:border-l lg:border-border",
        )}
      >
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
        <div
          className={cn("shrink-0", onBand && "bg-band text-band-foreground")}
        >
          <div aria-hidden className="flex justify-center pt-2 lg:hidden">
            <span
              className={cn(
                "h-1 w-10 rounded-full",
                onBand ? "bg-band-rule" : "bg-border",
              )}
            />
          </div>
          <div className="flex min-h-14 items-center gap-2 pl-4 pr-1.5 lg:pt-2">
            <Skeleton tone={onBand ? "band" : "surface"} className="h-6 w-48" />
          </div>
          {onBand ? (
            <div className="flex flex-col gap-2 border-t border-band-rule px-4 pt-3 pb-3.5">
              <Skeleton tone="band" className="h-7 w-48" />
              <Skeleton tone="band" className="h-4 w-32" />
            </div>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-col gap-3 rounded-[0.875rem] border border-border bg-card p-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="divide-y divide-border">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex min-h-14 items-center gap-3 py-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-5 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
