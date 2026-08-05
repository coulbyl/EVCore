"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight, Repeat } from "lucide-react";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useSubscriptions } from "@/domains/subscriptions/use-cases/get-subscriptions";

// Carte raccourci vers /dashboard/subscriptions — la page elle-même n'est
// atteignable que via le menu latéral (barre du bas mobile déjà pleine, 5
// slots), cette carte lui donne une entrée visible depuis l'accueil.
export function SubscriptionsShortcutCard() {
  const t = useTranslations("subscriptions");
  const currentUser = useCurrentUser();
  const { formatSigned } = useCurrencyFormat();
  const { data: subscriptions = [], isLoading } = useSubscriptions(
    currentUser.id,
  );

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const netPnl = subscriptions.reduce((sum, s) => sum + Number(s.netPnl), 0);

  return (
    <Link
      href="/dashboard/subscriptions"
      className="group flex flex-col rounded-[1.35rem] border border-border bg-panel-strong p-4 sm:p-5 ev-shell-shadow transition hover:border-accent/50"
    >
      <div className="flex items-center gap-2">
        <Repeat size={14} className="shrink-0 text-accent" />
        <h2 className="text-sm font-bold tracking-tight text-foreground">
          {t("pageTitle")}
        </h2>
        <ArrowRight
          size={14}
          className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
        />
      </div>

      {isLoading ? (
        <div className="mt-3 flex gap-3">
          <div className="bento-skeleton h-11 flex-1 rounded-xl" />
          <div className="bento-skeleton h-11 flex-1 rounded-xl" />
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="mt-3 flex flex-col items-center gap-1.5 py-3 text-center">
          <Repeat size={24} className="text-muted-foreground opacity-30" />
          <p className="text-xs text-muted-foreground">
            {t("empty.description")}
          </p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              {t("stats.activeCount")}
            </p>
            <p className="mt-1 text-lg font-bold text-foreground">
              {active.length}
            </p>
          </div>
          <div>
            <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
              {t("stats.netPnl")}
            </p>
            <p
              className={`mt-1 text-lg font-bold ${
                netPnl >= 0 ? "text-success" : "text-destructive"
              }`}
            >
              {formatSigned(netPnl)}
            </p>
          </div>
        </div>
      )}
    </Link>
  );
}
