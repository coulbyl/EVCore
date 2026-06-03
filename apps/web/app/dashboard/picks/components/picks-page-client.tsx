"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Drawer,
  DrawerContent,
  DrawerTitle,
  Page,
  PageHeader,
  PageHeaderActions,
  PageContent,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { usePicksOfTheDay } from "@/domains/fixture/use-cases/get-picks-of-the-day";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePickCelebration } from "@/hooks/use-pick-celebration";
import type { FixtureRow } from "@/domains/fixture/types/fixture";
import { FixtureDiagnostics } from "@/components/fixture-diagnostics";
import { DateNav } from "@/components/date-nav";
import { IndicesDrawerButton } from "@/components/indices-drawer-button";
import { todayIso } from "@/lib/date";
import { CanalSection } from "./canal-section";
import { PickListItem } from "./pick-list-item";

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

export function PicksPageClient() {
  const t = useTranslations("picks");
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const date = searchParams.get("date") ?? todayIso();
  const { data, isLoading, isError } = usePicksOfTheDay(date);

  const allRows = useMemo(() => data?.rows ?? [], [data]);
  usePickCelebration(allRows, date);

  const { ev, sv, conf, matchNul, btts } = useMemo(
    () => groupByCanal(allRows),
    [allRows],
  );

  const hasAny =
    ev.length + sv.length + conf.length + matchNul.length + btts.length > 0;

  const selectedRow = allRows.find((r) => r.fixtureId === selectedId) ?? null;

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
    const stillExists = allRows.some((r) => r.fixtureId === selectedId);
    if (!stillExists && defaultSelection) setSelectedId(defaultSelection);
  }, [allRows, defaultSelection, selectedId]);

  function handleSelect(row: FixtureRow) {
    setSelectedId(row.fixtureId);
    if (isMobile) setDrawerOpen(true);
  }

  function navigateTo(iso: string) {
    const params = new URLSearchParams({ date: iso });
    router.push(`/dashboard/picks?${params.toString()}`);
  }

  return (
    <Page className="flex h-full flex-col">
      <PageHeader>
        <div />
        <PageHeaderActions>
          <IndicesDrawerButton />
          <DateNav date={date} onChange={navigateTo} />
        </PageHeaderActions>
      </PageHeader>
      <PageContent className="min-h-0 flex-1 overflow-hidden rounded-[1.8rem] p-4 sm:p-5 ev-shell-shadow">
        <div className="flex h-full min-h-0 flex-col gap-5">
          <div className="min-h-0 flex-1 overflow-hidden">
            {isLoading && (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 size={22} className="animate-spin" />
              </div>
            )}

            {isError && !isLoading && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                {t("loadError")}
              </div>
            )}

            {!isLoading && !isError && !hasAny && (
              <div className="rounded-[1.2rem] border border-dashed border-border bg-panel/70 p-8 text-center text-sm text-muted-foreground">
                {t("empty")}
              </div>
            )}

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
