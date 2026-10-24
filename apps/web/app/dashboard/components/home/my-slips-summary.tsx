"use client";

import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@evcore/ui";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";

/**
 * Mes coupons en cours : uniquement quand l'utilisateur en a. Pour un nouvel
 * arrivant, un seul encart qui renvoie au coupon du jour, en haut de la page
 * — pas trois tuiles à zéro ni un état vide qui parle de filtres (revue UX du
 * 2026-10-11, P1-9).
 */
export function MySlipsSummary() {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();
  const { data, isLoading } = useOperatorSummary();

  if (isLoading) return <Skeleton className="h-28 rounded-2xl" />;
  if (!data) return null;

  if (data.slipCount === 0) {
    return (
      <section
        data-tour="home-my-slips"
        className="flex items-start gap-3 rounded-2xl border border-border bg-panel p-4"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
          <Receipt size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {t("mySlipsEmptyTitle")}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {t("mySlipsEmptyBody")}
          </p>
          <a
            href="#home-coupon-title"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
          >
            {t("mySlipsEmptyLink")} <ArrowRight size={12} />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section
      data-tour="home-my-slips"
      className="flex flex-col gap-3"
      aria-labelledby="home-my-slips-title"
    >
      <div className="flex items-center justify-between gap-3">
        <h2
          id="home-my-slips-title"
          className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
        >
          {t("mySlipsTitle")}
        </h2>
        <Link
          href="/dashboard/bet-slips"
          className="flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80"
        >
          {t("mySlipsLink")} <ArrowRight size={12} />
        </Link>
      </div>
      {/* Ce que le joueur veut savoir : combien de paris gagnés, perdus, en
          attente, et s'il est en gain ou en perte. Un taux de réussite seul
          trompait : 67 % à cote 1,3 peut être une perte (revue UX du
          2026-10-24, P1 n°3). */}
      <p data-testid="home-my-slips-tally" className="text-sm text-foreground">
        {t("mySlipsTally", {
          won: data.plays.won,
          lost: data.plays.lost,
          pending: data.plays.pending,
        })}
      </p>
      {/* Le chiffre d'abord, en grand ; l'effectif dessous. Un StatCard
          compact mettait le pourcentage en 12 px et l'effectif en 16 px. */}
      <div
        data-testid="home-my-slips-fixed-stake"
        className="rounded-2xl border border-border bg-panel px-4 py-3"
      >
        <p className="text-xs font-medium text-muted-foreground">
          {t("fixedStake")}
        </p>
        <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
          {data.plays.returnRate === null
            ? "—"
            : formatSignedPercent(Number(data.plays.returnRate), locale)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {data.plays.settled > 0
            ? t("fixedStakeSample", { count: data.plays.settled })
            : t("fixedStakeNone")}
        </p>
      </div>
    </section>
  );
}

/**
 * −0,041 → « −4,1 % » ; le signe toujours écrit, sauf à zéro, et un vrai
 * signe moins (U+2212) plutôt que le trait d'union que rend Intl.
 */
function formatSignedPercent(rate: number, locale: string): string {
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", {
    style: "percent",
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  })
    .format(rate)
    .replace("-", "\u2212");
}
