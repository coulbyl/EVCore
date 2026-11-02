import { useTranslations } from "next-intl";
import { Sheet } from "../sheet/sheet";
import { Skeleton } from "./skeleton";

/**
 * La feuille pendant que son contenu arrive : elle monte au toucher, avec
 * son en-tête et des lignes grises, et la vraie feuille prend sa place sans
 * remonter (`sheet-relay.ts`). Seulement sur les feuilles interceptées, qui
 * ne servent qu'en naviguant dans l'application : un premier chargement
 * arrive d'un bloc, sans flux (C0b de la refonte, budget LCP).
 */
export function SheetSkeleton({
  fallbackHref,
  tone = "plain",
}: {
  fallbackHref: string;
  tone?: "plain" | "band";
}) {
  const t = useTranslations("scoreboard.states");
  const onBand = tone === "band";

  return (
    <Sheet
      title={t("loading")}
      fallbackHref={fallbackHref}
      tone={tone}
      bandContent={
        onBand ? (
          <div className="flex flex-col gap-2">
            <Skeleton tone="band" className="h-7 w-48" />
            <Skeleton tone="band" className="h-4 w-32" />
          </div>
        ) : undefined
      }
    >
      <div aria-busy="true" className="flex flex-col gap-4">
        <span className="sr-only" role="status">
          {t("loading")}
        </span>
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
    </Sheet>
  );
}
