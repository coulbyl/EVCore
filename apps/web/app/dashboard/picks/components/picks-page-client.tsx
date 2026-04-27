"use client";

import { useMemo } from "react";
import { Loader2, TrendingUp, Shield, Brain } from "lucide-react";
import { Page, PageContent, StatCard } from "@evcore/ui";
import { usePicksOfTheDay } from "@/domains/fixture/use-cases/get-picks-of-the-day";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FixtureRow } from "@/domains/fixture/types/fixture";
import { EvPickCard } from "./pick-card";
import { SvPickCard } from "./pick-card";
import { ConfPickCard } from "./pick-card";

// ── canal grouping ────────────────────────────────────────────────────────────

function groupByCanal(rows: FixtureRow[]) {
  const ev: FixtureRow[] = [];
  const sv: FixtureRow[] = [];
  const conf: FixtureRow[] = [];

  for (const row of rows) {
    if (row.modelRun?.decision === "BET") ev.push(row);
    if (row.safeValueBet !== null) sv.push(row);
    if (row.prediction !== null) conf.push(row);
  }

  return { ev, sv, conf };
}

// ── section ───────────────────────────────────────────────────────────────────

function CanalSection({
  title,
  color,
  children,
  count,
}: {
  title: string;
  color: string;
  children: React.ReactNode;
  count: number;
}) {
  if (count === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span
          className="h-3.5 w-1 rounded-full"
          style={{ background: color }}
        />
        <h2 className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {title}
        </h2>
        <span
          className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
          }}
        >
          {count}
        </span>
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

export function PicksPageClient() {
  const { data, isLoading, isError } = usePicksOfTheDay();
  const isMobile = useIsMobile();

  const { ev, sv, conf } = useMemo(
    () => groupByCanal(data?.rows ?? []),
    [data],
  );

  const hasAny = ev.length + sv.length + conf.length > 0;

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          {/* Stats — fixed */}
          <section className="shrink-0 grid grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              compact={isMobile}
              icon={<TrendingUp size={14} />}
              label="Canal EV"
              value={String(ev.length)}
              tone="accent"
            />
            <StatCard
              compact={isMobile}
              icon={<Shield size={14} />}
              label="Safe Value"
              value={String(sv.length)}
              tone="success"
            />
            <StatCard
              compact={isMobile}
              icon={<Brain size={14} />}
              label="Confiance"
              value={String(conf.length)}
              tone="neutral"
            />
          </section>

          {/* Scrollable content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}

            {/* Error */}
            {isError && !isLoading && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                Impossible de charger les picks du jour.
              </div>
            )}

            {/* Empty */}
            {!isLoading && !isError && !hasAny && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                Aucun pick pour aujourd'hui.
              </div>
            )}

            {/* Canal sections */}
            {!isLoading && !isError && hasAny && (
              <div className="flex flex-col gap-6 pb-2">
                <CanalSection
                  title="Canal EV"
                  color="var(--canal-ev)"
                  count={ev.length}
                >
                  {ev.map((row) => (
                    <EvPickCard key={row.fixtureId} row={row} />
                  ))}
                </CanalSection>

                <CanalSection
                  title="Safe Value"
                  color="var(--canal-sv)"
                  count={sv.length}
                >
                  {sv.map((row) => (
                    <SvPickCard key={row.fixtureId} row={row} />
                  ))}
                </CanalSection>

                <CanalSection
                  title="Confiance"
                  color="var(--canal-conf)"
                  count={conf.length}
                >
                  {conf.map((row) => (
                    <ConfPickCard key={row.fixtureId} row={row} />
                  ))}
                </CanalSection>
              </div>
            )}
          </div>
        </div>
      </PageContent>
    </Page>
  );
}
