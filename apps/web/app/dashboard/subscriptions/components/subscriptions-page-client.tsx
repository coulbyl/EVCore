"use client";

import { useState } from "react";
import {
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
import { Repeat, Target, TrendingUp, Wallet } from "lucide-react";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { useCurrentUser } from "@/domains/auth/context/current-user-context";
import { useSubscriptions } from "@/domains/subscriptions/use-cases/get-subscriptions";
import { CreateSubscriptionDialog } from "./create-subscription-dialog";
import { SubscriptionCard } from "./subscription-card";
import { SubscriptionDetailDialog } from "./subscription-detail-dialog";

export function SubscriptionsPageClient() {
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const currentUser = useCurrentUser();
  const { data: subscriptions = [], isLoading } = useSubscriptions(
    currentUser.id,
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = subscriptions.filter((s) => s.status === "ACTIVE");
  const totalStaked = subscriptions.reduce(
    (sum, s) => sum + Number(s.totalStaked),
    0,
  );
  const netPnl = subscriptions.reduce((sum, s) => sum + Number(s.netPnl), 0);
  const globalRoi = totalStaked > 0 ? (netPnl / totalStaked) * 100 : null;

  return (
    <Page>
      <PageHeader>
        <div>
          <PageHeaderTitle>Abonnements</PageHeaderTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Une discipline figée par abonnement, simulée automatiquement —
            indépendant du portefeuille réel.
          </p>
        </div>
        <PageHeaderActions>
          <CreateSubscriptionDialog />
        </PageHeaderActions>
      </PageHeader>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-5 lg:grid-cols-4">
        <StatCard
          label="Abonnements actifs"
          value={String(active.length)}
          icon={<Repeat size={14} />}
        />
        <StatCard
          label="Total misé (simulé)"
          value={formatAmount(totalStaked)}
          icon={<Wallet size={14} />}
        />
        <StatCard
          label="Gain/perte net"
          value={formatSigned(netPnl)}
          tone={netPnl >= 0 ? "success" : "danger"}
          icon={<TrendingUp size={14} />}
        />
        <StatCard
          label="ROI global"
          value={
            globalRoi === null
              ? "—"
              : `${globalRoi >= 0 ? "+" : ""}${globalRoi.toFixed(1)}%`
          }
          tone={globalRoi !== null && globalRoi >= 0 ? "success" : "danger"}
          icon={<Target size={14} />}
        />
      </div>

      <PageContent>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chargement…
          </p>
        ) : subscriptions.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Repeat />
              </EmptyMedia>
              <EmptyTitle>Aucun abonnement</EmptyTitle>
              <EmptyDescription>
                Crée un abonnement pour suivre automatiquement une discipline de
                mise, sans y toucher jour après jour.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {subscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                subscription={sub}
                onClick={() => setSelectedId(sub.id)}
              />
            ))}
          </div>
        )}
      </PageContent>

      <SubscriptionDetailDialog
        subscriptionId={selectedId}
        onOpenChange={(open) => {
          if (!open) setSelectedId(null);
        }}
      />
    </Page>
  );
}
