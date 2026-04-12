"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, EmptyState, Page, PageContent } from "@evcore/ui";
import {
  formatMarketForDisplay,
  formatPickForDisplay,
} from "@/helpers/fixture";
import { formatDateLong } from "@/lib/date";
import { useBetSlipById } from "@/domains/bet-slip/use-cases/get-bet-slips";
import type { BetSlipItemView } from "@/domains/bet-slip/types/bet-slip";

function formatAmount(value: string) {
  return Number(value).toLocaleString("fr-FR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}

function ResultBadge({ item }: { item: BetSlipItemView }) {
  if (item.pnl !== null) {
    const isPositive = item.pnl.startsWith("+");
    const amount = formatAmount(item.pnl.replace("+", "").replace("-", ""));
    return (
      <Badge tone={isPositive ? "success" : "danger"}>
        {isPositive ? `+${amount} · Gagné` : `−${amount} · Perdu`}
      </Badge>
    );
  }
  if (item.betStatus === "VOID") return <Badge tone="neutral">Annulé</Badge>;
  // En attente : gain potentiel si cote disponible
  if (item.odds !== null) {
    const potential = (
      Number(item.stake) *
      (Number(item.odds) - 1)
    ).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    return <Badge tone="neutral">+{potential} potentiel</Badge>;
  }
  return <Badge tone="neutral">En attente</Badge>;
}

export function BetSlipDetailPageClient() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data } = useBetSlipById(id ?? "");

  const totalStake = data
    ? data.items.reduce((sum, item) => sum + Number(item.stake), 0)
    : 0;

  const settledItems =
    data?.items.filter(
      (i) => i.betStatus === "WON" || i.betStatus === "LOST",
    ) ?? [];
  const pendingCount = (data?.items.length ?? 0) - settledItems.length;

  const realPnl = settledItems.reduce((sum, item) => {
    if (item.pnl === null) return sum;
    return sum + Number(item.pnl);
  }, 0);

  // Retour total = mise + profit sur chaque pari gagné (stake × odds)
  const retourTotal = settledItems
    .filter((i) => i.betStatus === "WON" && i.pnl !== null)
    .reduce((sum, i) => sum + Number(i.stake) + Number(i.pnl), 0);

  const hasPnl = settledItems.length > 0;

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        {!data ? (
          <EmptyState
            title="Ticket introuvable"
            description="Le ticket demandé n'existe pas ou n'est plus accessible pour cette session."
          />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-[1.1rem] border border-border bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Ticket
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  #{data.id.slice(0, 8)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Créé le {formatDateLong(data.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{data.itemCount} paris</Badge>
                <Link
                  href="/dashboard/bet-slips"
                  className="inline-flex items-center justify-center rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Retour à la liste
                </Link>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
              <section className="space-y-3 rounded-[1.1rem] border border-border bg-white p-4">
                <DetailRow label="Utilisateur" value={`@${data.username}`} />
                <DetailRow
                  label="Mise par sélection"
                  value={formatAmount(data.unitStake)}
                />
                <DetailRow
                  label="Total misé"
                  value={formatAmount(String(totalStake))}
                />
                {hasPnl && (
                  <>
                    <div
                      className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${
                        realPnl >= 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}
                    >
                      <span>
                        {pendingCount > 0 ? "Gain net partiel" : "Gain net"}
                      </span>
                      <span className="tabular-nums">
                        {realPnl >= 0 ? "+" : ""}
                        {realPnl.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    {retourTotal > 0 && (
                      <DetailRow
                        label="Retour total"
                        value={retourTotal.toLocaleString("fr-FR", {
                          maximumFractionDigits: 2,
                        })}
                      />
                    )}
                  </>
                )}
                {pendingCount > 0 && (
                  <p className="text-xs text-slate-400">
                    {pendingCount} sélection{pendingCount > 1 ? "s" : ""} en
                    attente de résultat
                  </p>
                )}
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Ce ticket est un objet final. Sa composition et ses mises ne
                  sont plus modifiables après création.
                </div>
              </section>

              <section className="overflow-hidden rounded-[1.1rem] border border-border bg-white">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Sélections du ticket
                  </p>
                </div>

                <div className="divide-y divide-border">
                  {data.items.map((item) => (
                    <div key={item.betId} className="px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {item.fixture}
                            </p>
                            {item.homeScore !== null &&
                              item.awayScore !== null && (
                                <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-700">
                                  {item.homeScore} – {item.awayScore}
                                </span>
                              )}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatPickForDisplay(item.pick, item.market)} •{" "}
                            {formatMarketForDisplay(item.market)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ResultBadge item={item} />
                          {item.odds ? (
                            <Badge tone="neutral">Cote {item.odds}</Badge>
                          ) : null}
                          <Badge tone="success">Valeur {item.ev}</Badge>
                          <Badge tone="accent">
                            Mise {formatAmount(item.stake)}
                          </Badge>
                          {item.stakeOverride ? (
                            <Badge tone="warning">
                              Mise perso {formatAmount(item.stakeOverride)}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </PageContent>
    </Page>
  );
}
