"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Button,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
  StatCard,
} from "@evcore/ui";
import { Plus, Repeat, Target, TrendingUp, Wallet } from "lucide-react";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useSubscriptions } from "@/domains/subscriptions/use-cases/get-subscriptions";
import { SubscriptionCard } from "./subscription-card";

export function SubscriptionsPageClient() {
  const t = useTranslations("subscriptions");
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const currentUser = useCurrentUser();
  const { data: subscriptions = [], isLoading } = useSubscriptions(
    currentUser.id,
  );

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const totalStaked = subscriptions.reduce(
    (sum, s) => sum + Number(s.totalStaked),
    0,
  );
  const netPnl = subscriptions.reduce((sum, s) => sum + Number(s.netPnl), 0);
  const globalRoi = totalStaked > 0 ? (netPnl / totalStaked) * 100 : null;

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div>
          <PageHeaderTitle>{t("pageTitle")}</PageHeaderTitle>
          <p className="mt-1 text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <PageHeaderActions>
          <Button className="gap-2" asChild size="sm">
            <Link href="/dashboard/subscriptions/new">
              <Plus size={14} />
              {t("newSubscription")}
            </Link>
          </Button>
        </PageHeaderActions>
      </PageHeader>

      <PageContent className="min-h-0 flex-1 overflow-hidden p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <div className="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label={t("stats.activeCount")}
              value={String(active.length)}
              icon={<Repeat size={14} />}
              compact
            />
            <StatCard
              label={t("stats.totalStaked")}
              value={formatAmount(totalStaked)}
              icon={<Wallet size={14} />}
              compact
            />
            <StatCard
              label={t("stats.netPnl")}
              value={formatSigned(netPnl)}
              tone={netPnl >= 0 ? "success" : "danger"}
              icon={<TrendingUp size={14} />}
              compact
            />
            <StatCard
              label={t("stats.globalRoi")}
              value={
                globalRoi === null
                  ? "—"
                  : `${globalRoi >= 0 ? "+" : ""}${globalRoi.toFixed(1)}%`
              }
              tone={globalRoi !== null && globalRoi >= 0 ? "success" : "danger"}
              icon={<Target size={14} />}
              compact
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t("loading")}
              </p>
            ) : subscriptions.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Repeat />
                  </EmptyMedia>
                  <EmptyTitle>{t("empty.title")}</EmptyTitle>
                  <EmptyDescription>{t("empty.description")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="grid grid-cols-1 gap-3 pb-4 md:grid-cols-2 xl:grid-cols-3">
                {subscriptions.map((sub) => (
                  <SubscriptionCard key={sub.id} subscription={sub} />
                ))}
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
