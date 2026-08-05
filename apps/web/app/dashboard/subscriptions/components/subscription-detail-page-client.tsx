"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Trash2 } from "lucide-react";
import {
  Badge,
  Button,
  Page,
  PageContent,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";
import { useSubscriptionDetail } from "@/domains/subscriptions/use-cases/get-subscription-detail";
import { useCancelSubscription } from "@/domains/subscriptions/use-cases/cancel-subscription";
import { useDeleteSubscription } from "@/domains/subscriptions/use-cases/delete-subscription";
import { formatDayConditions, statusLabel } from "../subscriptions-constants";
import { SubscriptionDetailView } from "./subscription-detail-view";
import { DeleteSubscriptionDialog } from "./delete-subscription-dialog";
import { SubscriptionSourceHeader } from "./subscription-source-badge";

export function SubscriptionDetailPageClient({
  subscriptionId,
}: {
  subscriptionId: string;
}) {
  const t = useTranslations("subscriptions");
  const router = useRouter();
  const { data: subscription, isLoading } =
    useSubscriptionDetail(subscriptionId);
  const cancelMutation = useCancelSubscription();
  const deleteMutation = useDeleteSubscription();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-5">
        <div className="mx-auto flex w-full min-h-0 max-w-3xl flex-1 flex-col gap-0">
          <nav className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link
              href="/dashboard/subscriptions"
              className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
            >
              <ArrowLeft size={12} />
              {t("pageTitle")}
            </Link>
          </nav>

          <PageHeader className="shrink-0">
            <div className="min-w-0">
              {subscription ? (
                <div className="flex items-center justify-between gap-3">
                  <SubscriptionSourceHeader subscription={subscription} />
                  <Badge
                    variant={
                      subscription.status === "ACTIVE" ? "default" : "secondary"
                    }
                  >
                    {statusLabel(subscription.status, t)}
                  </Badge>
                </div>
              ) : (
                <PageHeaderTitle>{t("detail.notFoundTitle")}</PageHeaderTitle>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {subscription
                  ? `${subscription.startDate} → ${subscription.endDate} · ${formatDayConditions(subscription, t)}`
                  : isLoading
                    ? t("loading")
                    : t("detail.notFound")}
              </p>
            </div>
            {subscription ? (
              <PageHeaderActions>
                {subscription.status === "ACTIVE" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={cancelMutation.isPending}
                    onClick={() => cancelMutation.mutate(subscription.id)}
                  >
                    {t("detail.cancel")}
                  </Button>
                ) : null}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label={t("detail.delete")}
                  disabled={deleteMutation.isPending}
                  onClick={() => setConfirmOpen(true)}
                >
                  <Trash2 size={14} />
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

        {subscription ? (
          <DeleteSubscriptionDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            isDeleting={deleteMutation.isPending}
            onConfirm={() => {
              deleteMutation.mutate(subscription.id, {
                onSuccess: () => router.push("/dashboard/subscriptions"),
              });
            }}
          />
        ) : null}
      </PageContent>
    </Page>
  );
}
