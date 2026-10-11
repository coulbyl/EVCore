"use client";

import Link from "next/link";
import { ArrowRight, Receipt } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton, StatCard } from "@evcore/ui";
import { useOperatorSummary } from "@/domains/bet-slip/use-cases/get-operator-summary";

/**
 * Mes coupons en cours : uniquement quand l'utilisateur en a. Pour un nouvel
 * arrivant, un seul encart qui renvoie au coupon du jour, en haut de la page
 * — pas trois tuiles à zéro ni un état vide qui parle de filtres (revue UX du
 * 2026-10-11, P1-9).
 */
export function MySlipsSummary() {
  const t = useTranslations("dashboard.home");
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
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          compact
          tone="neutral"
          label={t("pending")}
          value={String(data.pendingBets)}
        />
        <StatCard
          compact
          tone="success"
          label={t("won")}
          value={String(data.wonBets)}
        />
        <StatCard
          compact
          tone="neutral"
          label={t("winRate")}
          value={data.settledBets > 0 ? data.winRate : "—"}
        />
      </div>
    </section>
  );
}
