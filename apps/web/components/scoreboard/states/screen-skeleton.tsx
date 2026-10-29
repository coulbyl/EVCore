import { useTranslations } from "next-intl";
import { Skeleton } from "./skeleton";

/**
 * La forme d'un écran pendant qu'il se charge : le bandeau, une carte, des
 * lignes, chacun à sa place, en gris. Les hauteurs sont celles des vrais
 * blocs, pour que rien ne saute quand le contenu arrive.
 */
export function ScreenSkeleton() {
  const t = useTranslations("scoreboard.states");

  return (
    <div aria-busy="true">
      <span className="sr-only" role="status">
        {t("loading")}
      </span>
      <div className="bg-band px-4 pb-3.5 pt-[max(1rem,env(safe-area-inset-top))] dark:border-b dark:border-band-rule lg:px-6 lg:pt-4">
        <div className="flex min-h-11 items-center justify-between lg:hidden">
          <Skeleton tone="band" className="h-6 w-20" />
          <div className="flex gap-2.5">
            <Skeleton tone="band" className="size-11 rounded-full" />
            <Skeleton tone="band" className="size-11 rounded-full" />
          </div>
        </div>
        <div className="mt-3 border-t border-band-rule pt-3 lg:mt-0 lg:border-t-0 lg:pt-0">
          <Skeleton tone="band" className="h-6 w-56" />
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 pt-4 lg:px-6">
        <div className="flex flex-col gap-3 rounded-[0.875rem] border border-border bg-card p-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-12 w-full rounded-[0.625rem]" />
        </div>
        <div className="divide-y divide-border">
          {[0, 1, 2].map((row) => (
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
  );
}
