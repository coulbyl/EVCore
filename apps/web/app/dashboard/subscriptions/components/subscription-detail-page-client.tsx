"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowLeft, Repeat } from "lucide-react";
import {
  Button,
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";
import { useSubscriptionDetail } from "@/domains/subscriptions/use-cases/get-subscription-detail";
import { useCancelSubscription } from "@/domains/subscriptions/use-cases/cancel-subscription";
import { formatDayConditions, sourceLabel } from "../subscriptions-constants";
import { SubscriptionDetailView } from "./subscription-detail-view";

export function SubscriptionDetailPageClient({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const t = useTranslations("subscriptions");
  const { data: subscription, isLoading } =
    useSubscriptionDetail(subscriptionId);
  const cancelMutation = useCancelSubscription();

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/dashboard/subscriptions"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ArrowLeft size={12} />
              {t("pageTitle")}
            </Link>
          </nav>

          <PageHeader>
            <div className="min-w-0">
              <PageHeaderTitle className="flex items-center gap-2">
                <Repeat size={16} className="text-accent" />
                {subscription
                  ? sourceLabel(subscription.sourceType, t)
                  : t("detail.notFoundTitle")}
              </PageHeaderTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription
                  ? `${subscription.startDate} → ${subscription.endDate} · ${formatDayConditions(subscription, t)}`
                  : isLoading
                    ? t("loading")
                    : t("detail.notFound")}
              </p>
            </div>
            {subscription?.status === "ACTIVE" ? (
              <PageHeaderActions>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cancelMutation.isPending}
                  onClick={() => cancelMutation.mutate(subscription.id)}
                >
                  {t("detail.cancel")}
                </Button>
              </PageHeaderActions>
            ) : null}
          </PageHeader>

          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("loading")}
            </p>
          ) : subscription ? (
            <SubscriptionDetailView subscription={subscription} />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {t("detail.notFoundOrDeleted")}
            </p>
          )}
        </div>
      </PageContent>
    </Page>
  );
}
