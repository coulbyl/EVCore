"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  TrendingUp,
  Shield,
  Brain,
  Minus,
  Activity,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Drawer,
  DrawerContent,
  DrawerTitle,
  Page,
  PageContent,
  StatCard,
  FilterBar,
  type FilterDef,
  type FilterState,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { usePicksOfTheDay } from "@/domains/fixture/use-cases/get-picks-of-the-day";
import { useIsMobile } from "@/hooks/use-mobile";
import type { FixtureRow } from "@/domains/fixture/types/fixture";
import { CanalBadge } from "@/components/canal-badge";
import { formatCombinedPickForDisplay } from "@/helpers/fixture";
import { formatKickoff, formatScore } from "@/domains/fixture/helpers/fixture";
import { AddToSlipInline } from "./add-to-slip-inline";
import { FixtureDiagnostics } from "@/components/fixture-diagnostics";
import { todayIso } from "@/lib/date";

// ── canal grouping ────────────────────────────────────────────────────────────

function groupByCanal(rows: FixtureRow[]) {
  const ev: FixtureRow[] = [];
  const sv: FixtureRow[] = [];
  const conf: FixtureRow[] = [];
  const matchNul: FixtureRow[] = [];
  const btts: FixtureRow[] = [];

  for (const row of rows) {
    if (row.modelRun?.decision === "BET") ev.push(row);
    if (row.safeValueBet !== null) sv.push(row);
    if (row.prediction !== null) conf.push(row);
    if (row.drawPrediction !== null) matchNul.push(row);
    if (row.bttsPrediction !== null) btts.push(row);
  }

  return { ev, sv, conf, matchNul, btts };
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

function TeamLogos({
  homeLogo,
  awayLogo,
}: {
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {homeLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={homeLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-secondary" />
      )}
      {awayLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={awayLogo} alt="" className="size-5 object-contain" />
      ) : (
        <div className="size-5 rounded-full bg-secondary" />
      )}
    </div>
  );
}

function ResultBadge({
  status,
}: {
  status: "WON" | "LOST" | "PENDING" | null;
}) {
  if (!status) return null;
  if (status === "PENDING")
    return <span className="text-xs text-muted-foreground">En attente</span>;
  return (
    <Badge
      variant={status === "WON" ? "success" : "destructive"}
      className="rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest"
    >
      {status === "WON" ? "Gagné" : "Perdu"}
    </Badge>
  );
}

const CONF_PICK_LABEL: Record<string, string> = {
  HOME: "DOM",
  AWAY: "EXT",
  DRAW: "NUL",
};

function PredictionBadge({
  pred,
  canal,
}: {
  pred: FixtureRow["prediction"];
  canal: "CONF" | "DRAW" | "BTTS";
}) {
  const t = useTranslations("picks");
  if (!pred) return null;
  const bttsLabel =
    pred.pick === "YES"
      ? t("bttsYes")
      : pred.pick === "NO"
        ? t("bttsNo")
        : null;
  const label =
    canal === "BTTS" && bttsLabel != null
      ? bttsLabel
      : (CONF_PICK_LABEL[pred.pick] ?? pred.pick);
  const canalColor =
    canal === "DRAW"
      ? "var(--canal-draw)"
      : canal === "BTTS"
        ? "var(--canal-btts)"
        : "var(--canal-conf)";
  const canalSoft =
    canal === "DRAW"
      ? "var(--canal-draw-soft)"
      : canal === "BTTS"
        ? "var(--canal-btts-soft)"
        : "var(--canal-conf-soft)";

  if (pred.correct === true) {
    return (
      <Badge
        variant="success"
        className="gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums"
      >
        → {label} {pred.probability}
      </Badge>
    );
  }

  if (pred.correct === false) {
    return (
      <Badge
        variant="destructive"
        className="gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums"
      >
        → {label} {pred.probability}
      </Badge>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tabular-nums"
      style={{
        color: canalColor,
        background: canalSoft,
        border: `1px solid color-mix(in srgb, ${canalColor} 22%, transparent)`,
      }}
    >
      → {label} {pred.probability}
    </span>
  );
}

function PickListItem({
  row,
  canal,
  active,
  onSelect,
}: {
  row: FixtureRow;
  canal: "EV" | "SV" | "CONF" | "DRAW" | "BTTS";
  active: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("picks");
  const mr = row.modelRun;
  const sv = row.safeValueBet;
  const prediction =
    canal === "DRAW"
      ? row.drawPrediction
      : canal === "BTTS"
        ? row.bttsPrediction
        : row.prediction;

  function resolvePredLabel(pick: string): string {
    if (canal === "BTTS") {
      if (pick === "YES") return t("bttsYes");
      if (pick === "NO") return t("bttsNo");
    }
    return CONF_PICK_LABEL[pick] ?? pick;
  }

  const pickLabel =
    canal === "EV" && mr?.market && mr.pick
      ? formatCombinedPickForDisplay({
          market: mr.market,
          pick: mr.pick,
          comboMarket: mr.comboMarket ?? undefined,
          comboPick: mr.comboPick ?? undefined,
        })
      : canal === "SV" && sv
        ? formatCombinedPickForDisplay({
            market: sv.market,
            pick: sv.pick,
            comboMarket: sv.comboMarket ?? undefined,
            comboPick: sv.comboPick ?? undefined,
          })
        : canal !== "EV" && canal !== "SV" && prediction
          ? resolvePredLabel(prediction.pick)
          : null;

  const odds =
    canal === "EV" && mr?.market && mr.pick
      ? (mr.evaluatedPicks.find(
          (p) =>
            p.market === mr.market &&
            p.pick === mr.pick &&
            (p.comboMarket ?? null) === (mr.comboMarket ?? null) &&
            (p.comboPick ?? null) === (mr.comboPick ?? null),
        )?.odds ?? null)
      : canal === "SV"
        ? (sv?.odds ?? null)
        : null;

  const evValue =
    canal === "EV"
      ? (mr?.ev ?? null)
      : canal === "SV"
        ? (sv?.ev ?? null)
        : null;

  const score = formatScore(row.score, row.htScore);
  const betStatus =
    canal === "EV"
      ? (mr?.betStatus ?? null)
      : canal === "SV"
        ? (sv?.betStatus ?? null)
        : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`group flex items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
        active
          ? "border-accent/30 bg-accent/10"
          : "border-border bg-panel-strong hover:bg-secondary"
      }`}
      data-testid="pick-list-item"
    >
      <TeamLogos homeLogo={row.homeLogo} awayLogo={row.awayLogo} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground group-hover:text-accent">
            {row.fixture}
          </p>
          <CanalBadge canal={canal} />
        </div>

        <p className="mt-0.5 text-xs text-muted-foreground">
          {row.competition}
          {" · "}
          {formatKickoff(row.scheduledAt)}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {pickLabel ? (
            <Badge variant="secondary" className="text-[0.68rem]">
              {pickLabel}
            </Badge>
          ) : null}
          {canal !== "EV" && canal !== "SV" ? (
            <PredictionBadge pred={prediction} canal={canal} />
          ) : null}
          {score ? (
            <Badge variant="outline" className="text-[0.68rem] tabular-nums">
              {score}
            </Badge>
          ) : null}
          {odds ? (
            <Badge variant="outline" className="text-[0.68rem] tabular-nums">
              {odds}
            </Badge>
          ) : null}
          {evValue ? (
            <span
              className="text-xs font-semibold tabular-nums"
              style={{
                color:
                  canal === "EV"
                    ? "var(--canal-ev)"
                    : canal === "SV"
                      ? "var(--canal-sv)"
                      : canal === "DRAW"
                        ? "var(--canal-draw)"
                        : canal === "BTTS"
                          ? "var(--canal-btts)"
                          : "var(--canal-conf)",
              }}
            >
              {evValue}
            </span>
          ) : null}

          <ResultBadge status={betStatus} />

          {canal === "EV" ? (
            <AddToSlipInline row={row} canal="EV" />
          ) : canal === "SV" ? (
            <AddToSlipInline row={row} canal="SV" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── main ──────────────────────────────────────────────────────────────────────

const FILTER_DEFS: FilterDef[] = [
  {
    key: "date",
    label: "Date",
    type: "date",
  },
];

export function PicksPageClient() {
  const t = useTranslations("picks");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const date = searchParams.get("date") ?? todayIso();
  const { data, isLoading, isError } = usePicksOfTheDay(date);

  const [filters, setFilters] = useState<FilterState>({ date });

  useEffect(() => {
    setFilters({ date });
  }, [date]);

  const { ev, sv, conf, matchNul, btts } = useMemo(
    () => groupByCanal(data?.rows ?? []),
    [data],
  );

  const hasAny =
    ev.length + sv.length + conf.length + matchNul.length + btts.length > 0;

  const selectedRow =
    (data?.rows ?? []).find((r) => r.fixtureId === selectedId) ?? null;

  const defaultSelection =
    sv[0]?.fixtureId ??
    btts[0]?.fixtureId ??
    conf[0]?.fixtureId ??
    matchNul[0]?.fixtureId ??
    ev[0]?.fixtureId ??
    null;

  useEffect(() => {
    if (!selectedId && defaultSelection) setSelectedId(defaultSelection);
  }, [defaultSelection, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const stillExists = (data?.rows ?? []).some(
      (r) => r.fixtureId === selectedId,
    );
    if (!stillExists && defaultSelection) setSelectedId(defaultSelection);
  }, [data?.rows, defaultSelection, selectedId]);

  function handleSelect(row: FixtureRow) {
    setSelectedId(row.fixtureId);
    if (isMobile) setDrawerOpen(true);
  }

  function handleFiltersChange(next: FilterState) {
    setFilters(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("date", (next.date as string) ?? todayIso());
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          {/* Stats — fixed */}
          <section className="shrink-0 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:gap-4">
            <StatCard
              compact={isMobile}
              icon={<Shield size={14} />}
              label={t("safeValue")}
              value={String(sv.length)}
              tone="success"
            />
            <StatCard
              compact={isMobile}
              icon={<Activity size={14} />}
              label={t("btts")}
              value={String(btts.length)}
              tone="danger"
            />
            <StatCard
              compact={isMobile}
              icon={<Brain size={14} />}
              label={t("confidence")}
              value={String(conf.length)}
              tone="neutral"
            />
            <StatCard
              compact={isMobile}
              icon={<Minus size={14} />}
              label={t("matchNull")}
              value={String(matchNul.length)}
              tone="warning"
            />
            <StatCard
              compact={isMobile}
              icon={<TrendingUp size={14} />}
              label={t("evChannel")}
              value={String(ev.length)}
              tone="accent"
            />
          </section>

          <section className="shrink-0">
            <FilterBar
              filters={FILTER_DEFS}
              value={filters}
              onChange={handleFiltersChange}
            />
          </section>

          {/* Scrollable content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}

            {/* Error */}
            {isError && !isLoading && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                {t("loadError")}
              </div>
            )}

            {/* Empty */}
            {!isLoading && !isError && !hasAny && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </div>
            )}

            {/* Canal sections */}
            {!isLoading && !isError && hasAny && (
              <div className="grid h-full grid-cols-1 gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-5">
                <div className="min-h-0 overflow-y-auto pr-0 lg:pr-1">
                  <div className="flex flex-col gap-6 pb-2">
                    <CanalSection
                      title={t("safeValue")}
                      color="var(--canal-sv)"
                      count={sv.length}
                    >
                      {sv.map((row) => (
                        <PickListItem
                          key={`${row.fixtureId}-sv`}
                          row={row}
                          canal="SV"
                          active={row.fixtureId === selectedId}
                          onSelect={() => handleSelect(row)}
                        />
                      ))}
                    </CanalSection>

                    <CanalSection
                      title={t("bttsLabel")}
                      color="var(--canal-btts)"
                      count={btts.length}
                    >
                      {btts.map((row) => (
                        <PickListItem
                          key={`${row.fixtureId}-btts`}
                          row={row}
                          canal="BTTS"
                          active={row.fixtureId === selectedId}
                          onSelect={() => handleSelect(row)}
                        />
                      ))}
                    </CanalSection>

                    <CanalSection
                      title={t("confidence")}
                      color="var(--canal-conf)"
                      count={conf.length}
                    >
                      {conf.map((row) => (
                        <PickListItem
                          key={`${row.fixtureId}-conf`}
                          row={row}
                          canal="CONF"
                          active={row.fixtureId === selectedId}
                          onSelect={() => handleSelect(row)}
                        />
                      ))}
                    </CanalSection>

                    <CanalSection
                      title={t("matchNull")}
                      color="var(--canal-draw)"
                      count={matchNul.length}
                    >
                      {matchNul.map((row) => (
                        <PickListItem
                          key={`${row.fixtureId}-draw`}
                          row={row}
                          canal="DRAW"
                          active={row.fixtureId === selectedId}
                          onSelect={() => handleSelect(row)}
                        />
                      ))}
                    </CanalSection>

                    <CanalSection
                      title={t("evChannel")}
                      color="var(--canal-ev)"
                      count={ev.length}
                    >
                      {ev.map((row) => (
                        <PickListItem
                          key={row.fixtureId}
                          row={row}
                          canal="EV"
                          active={row.fixtureId === selectedId}
                          onSelect={() => handleSelect(row)}
                        />
                      ))}
                    </CanalSection>
                  </div>
                </div>

                <div className="hidden min-h-0 overflow-y-auto lg:block">
                  {selectedRow ? (
                    <FixtureDiagnostics row={selectedRow} />
                  ) : (
                    <div className="flex min-h-80 items-center justify-center rounded-[1.7rem] border border-border bg-panel p-6 text-center">
                      <p className="text-sm text-muted-foreground">
                        Sélectionnez un pick pour voir le diagnostic.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DrawerContent className="z-50 flex max-h-[92dvh] flex-col rounded-t-[1.6rem] border-t border-border bg-panel-strong focus:outline-none">
              <DrawerTitle className="sr-only">Diagnostic pick</DrawerTitle>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-10 sm:p-5">
                {selectedRow ? (
                  <FixtureDiagnostics row={selectedRow} />
                ) : (
                  <div className="flex min-h-80 items-center justify-center rounded-[1.7rem] border border-border bg-panel p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      Sélectionnez un pick pour voir le diagnostic.
                    </p>
                  </div>
                )}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </PageContent>
    </Page>
  );
}
