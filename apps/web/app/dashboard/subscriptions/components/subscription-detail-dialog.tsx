"use client";

import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@evcore/ui";
import { Repeat, X } from "lucide-react";
import { Amount } from "@/components/amount";
import { useSubscriptionDetail } from "@/domains/subscriptions/use-cases/get-subscription-detail";
import { useCancelSubscription } from "@/domains/subscriptions/use-cases/cancel-subscription";
import {
  STATUS_LABEL,
  formatDayConditions,
  subscriptionRoiPct,
} from "../subscriptions-constants";

const RESULT_LABEL: Record<"WON" | "LOST" | "VOID", string> = {
  WON: "Gagné",
  LOST: "Perdu",
  VOID: "Remboursé",
};

export function SubscriptionDetailDialog({
  subscriptionId,
  onOpenChange,
}: {
  subscriptionId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: subscription, isLoading } =
    useSubscriptionDetail(subscriptionId);
  const cancelMutation = useCancelSubscription();
  const roi = subscription ? subscriptionRoiPct(subscription) : null;

  return (
    <Dialog open={subscriptionId !== null} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="bento-cell w-[calc(100vw-2rem)] max-w-xl bg-panel p-6"
      >
        {/* Radix exige un DialogTitle/DialogDescription dès que le contenu est
            monté, même pendant le chargement — rendus ici en permanence,
            avec un texte de repli tant que les données ne sont pas là. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Repeat size={16} className="text-accent" />
              {subscription?.sourceLabel ?? "Détail de l'abonnement"}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-muted-foreground">
              {subscription
                ? `${subscription.startDate} → ${subscription.endDate} · ${formatDayConditions(subscription)}`
                : "Chargement…"}
            </DialogDescription>
          </div>
          <DialogClose asChild>
            <button
              type="button"
              className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <X size={16} />
            </button>
          </DialogClose>
        </div>

        {isLoading ? null : subscription ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg border border-border bg-panel-strong p-3">
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                  Statut
                </p>
                <Badge className="mt-1" variant="secondary">
                  {STATUS_LABEL[subscription.status]}
                </Badge>
              </div>
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                  Total misé
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">
                  <Amount value={subscription.totalStaked} />
                </p>
              </div>
              <div>
                <p className="text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
                  ROI
                </p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    roi === null
                      ? "text-muted-foreground"
                      : roi >= 0
                        ? "text-success"
                        : "text-destructive"
                  }`}
                >
                  {roi === null
                    ? "—"
                    : `${roi >= 0 ? "+" : ""}${roi.toFixed(1)}%`}
                </p>
              </div>
            </div>

            {subscription.status === "ACTIVE" ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 self-start"
                disabled={cancelMutation.isPending}
                onClick={() => cancelMutation.mutate(subscription.id)}
              >
                Annuler l&apos;abonnement
              </Button>
            ) : null}

            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Historique des événements
              </p>
              {subscription.events.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun événement pour le moment.
                </p>
              ) : (
                <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
                  {subscription.events.map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-foreground">
                          {event.label}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {event.date}
                          {event.odds
                            ? ` · cote ${Number(event.odds).toFixed(2)}`
                            : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {event.result ? (
                          <>
                            <Badge
                              variant={
                                event.result === "WON" ? "default" : "secondary"
                              }
                            >
                              {RESULT_LABEL[event.result]}
                            </Badge>
                            <p
                              className={`mt-1 text-xs font-medium ${
                                Number(event.pnl ?? 0) >= 0
                                  ? "text-success"
                                  : "text-destructive"
                              }`}
                            >
                              <Amount value={event.pnl ?? "0"} signed />
                            </p>
                          </>
                        ) : (
                          <Badge variant="outline">En attente</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
