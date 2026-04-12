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

function formatStake(value: string) {
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

export function BetSlipDetailPageClient() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { data, isFetching, isError, refetch } = useBetSlipById(id ?? "");

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-y-auto rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        {!data ? (
          <EmptyState
            title="Bet slip introuvable"
            description="Le slip demandé n'existe pas ou n'est plus accessible pour cette session."
          />
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col gap-4 rounded-[1.1rem] border border-border bg-white p-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Bet slip
                </p>
                <h2 className="mt-1 text-xl font-semibold text-slate-900">
                  #{data.id.slice(0, 8)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Créé le {formatDateLong(data.createdAt)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{data.itemCount} bets</Badge>
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
                  label="Mise unitaire"
                  value={formatStake(data.unitStake)}
                />
                <DetailRow
                  label="Total engagé"
                  value={formatStake(
                    String(
                      data.items.reduce(
                        (sum, item) => sum + Number(item.stake),
                        0,
                      ),
                    ),
                  )}
                />
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-800">
                  Ce slip est un objet final. Sa composition et ses mises ne
                  sont plus modifiables après création.
                </div>
              </section>

              <section className="overflow-hidden rounded-[1.1rem] border border-border bg-white">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Bets du slip
                  </p>
                </div>

                <div className="divide-y divide-border">
                  {data.items.map((item) => (
                    <div key={item.betId} className="px-4 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {item.fixture}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatPickForDisplay(item.pick, item.market)} •{" "}
                            {formatMarketForDisplay(item.market)}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {item.odds ? (
                            <Badge tone="neutral">Cote {item.odds}</Badge>
                          ) : null}
                          <Badge tone="success">EV {item.ev}</Badge>
                          <Badge tone="accent">
                            Stake {formatStake(item.stake)}
                          </Badge>
                          {item.stakeOverride ? (
                            <Badge tone="warning">
                              Override {formatStake(item.stakeOverride)}
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
