import Link from "next/link";
import { useTranslations } from "next-intl";
import { stateActionClass } from "./state-line";

/**
 * Ce qu'un écran fermé par la pause montre à la place de son contenu
 * (09-moi.md § 4, 10-transverse.md § 2) : la date de retour, ce qui reste
 * ouvert, et Prolonger. La pause prime sur tout autre état.
 *
 * `until` est déjà formaté (« 5/11 à 19:00 »).
 */
export function PauseNotice({ until }: { until: string }) {
  const t = useTranslations("scoreboard.states");
  const tabs = useTranslations("shell.tabs");
  const link =
    "flex min-h-11 flex-1 items-center justify-center rounded-[0.625rem] border border-primary text-body font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

  return (
    <section className="flex flex-col items-start gap-3 rounded-[0.875rem] border border-border bg-card p-4">
      <h2 className="score text-title font-semibold">
        {t("pauseTitle", { until })}
      </h2>
      <p className="text-body text-muted-foreground">{t("pauseBody")}</p>
      <div className="flex w-full gap-2.5">
        <Link href="/results" className={link}>
          {tabs("results")}
        </Link>
        <Link href="/me" className={link}>
          {tabs("me")}
        </Link>
      </div>
      <Link href="/me/responsible-gambling" className={stateActionClass}>
        {t("pauseExtend")}
      </Link>
    </section>
  );
}
