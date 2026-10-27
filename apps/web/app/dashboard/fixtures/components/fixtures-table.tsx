"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useIsMobile } from "@/hooks/use-mobile";
import { ChevronRight } from "lucide-react";
import {
  DataTable,
  Drawer,
  DrawerContent,
  DrawerTitle,
  type ColumnDef,
} from "@evcore/ui";
import { SettleFixtureDialog } from "@/components/settle-fixture-dialog";
import { formatScore, formatKickoff } from "@/domains/fixture/helpers/fixture";
import {
  fixtureStatusBadgeClass,
  fixtureStatusIsNotable,
  fixtureStatusLabel,
} from "@/helpers/fixture";
import type { FixtureRow } from "@/domains/fixture/types/fixture";
import { FixtureDiagnostics } from "@/components/fixture-diagnostics";
import { useFixtures } from "@/domains/fixture/use-cases/use-fixtures";
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel";

// ---------------------------------------------------------------------------
// Cell badge helpers
// ---------------------------------------------------------------------------

function FixtureTeamLogos({
  homeLogo,
  awayLogo,
}: {
  homeLogo: string | null;
  awayLogo: string | null;
}) {
  return (
    <div className="flex items-center gap-1">
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

// Saisie manuelle du résultat, pour les admins, tant que le match n'est pas
// terminé. Elle dépendait d'un pari interne VALUE/SAFE (table `bet`, vide
// depuis le 2026-09-04) et n'apparaissait donc plus jamais.
function ResultAction({ row, isAdmin }: { row: FixtureRow; isAdmin: boolean }) {
  if (!isAdmin || row.status === "FINISHED") return null;
  return (
    <SettleFixtureDialog
      fixtureId={row.fixtureId}
      fixtureName={row.fixture}
      triggerSize="xs"
    />
  );
}

// ---------------------------------------------------------------------------
// Mobile card
// ---------------------------------------------------------------------------

function FixtureMobileCard({
  row,
  isAdmin,
  selected,
  onSelect,
}: {
  row: FixtureRow;
  isAdmin: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const score = formatScore(row.score, row.htScore);

  return (
    <div
      className={`rounded-[1.2rem] border p-4 transition-colors ${selected ? "border-accent bg-accent/5" : "border-border bg-panel-strong"}`}
    >
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
        className="w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <FixtureTeamLogos
                homeLogo={row.homeLogo}
                awayLogo={row.awayLogo}
              />
              <p className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                {row.fixture}
              </p>
            </div>
            {fixtureStatusIsNotable(row.status) && (
              <span
                className={`inline-flex shrink-0 items-center rounded-full border px-2 py-1 text-xs font-semibold uppercase tracking-[0.08em] ${fixtureStatusBadgeClass(row.status)}`}
              >
                {fixtureStatusLabel(row.status)}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">
                {row.competition}
              </span>
              <span className="mx-1.5">·</span>
              {formatKickoff(row.scheduledAt)}
              {score && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {score}
                  </span>
                </>
              )}
            </p>
            <ChevronRight
              size={14}
              className="shrink-0 text-muted-foreground"
            />
          </div>
        </div>
      </div>

      {isAdmin && row.status !== "FINISHED" && (
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <ResultAction row={row} isAdmin={isAdmin} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function makeColumns(isAdmin: boolean): ColumnDef<FixtureRow>[] {
  return [
    {
      id: "fixture",
      header: "Match",
      meta: { pin: "left" },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <FixtureTeamLogos
            homeLogo={row.original.homeLogo}
            awayLogo={row.original.awayLogo}
          />
          <span className="text-sm font-semibold text-foreground">
            {row.original.fixture}
          </span>
        </div>
      ),
    },
    {
      id: "score",
      header: "Score",
      cell: ({ row }) => {
        const score = formatScore(row.original.score, row.original.htScore);
        return (
          <span className="font-mono text-sm text-foreground">
            {score ?? <span className="text-muted-foreground">—</span>}
          </span>
        );
      },
    },
    {
      id: "competition",
      header: "Compétition",
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">
          {row.original.competition}
        </span>
      ),
    },
    {
      id: "scheduledAt",
      header: "Heure",
      meta: { align: "right" },
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-foreground">
          {formatKickoff(row.original.scheduledAt)}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      meta: { pin: "right", align: "right" },
      cell: ({ row }) => (
        <div
          className="flex items-center justify-end gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <ResultAction row={row.original} isAdmin={isAdmin} />
        </div>
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FixturesTable({
  date,
  isAdmin,
}: {
  date: string;
  isAdmin: boolean;
}) {
  const t = useTranslations("table");
  const isMobile = useIsMobile();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    allRows,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useFixtures(date);

  const selectedRow = allRows.find((r) => r.fixtureId === selectedId) ?? null;
  const columns = makeColumns(isAdmin);

  function handleRowClick(row: FixtureRow) {
    setSelectedId(row.fixtureId);
    setDrawerOpen(true);
  }

  if (isError) {
    return (
      <div className="rounded-[1.3rem] border border-destructive/20 bg-destructive/10 p-6 text-center">
        <p className="font-semibold text-destructive">
          Les matchs n&apos;ont pas chargé.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Recharge la page dans un instant.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DataTable
        columns={columns}
        data={allRows}
        isLoading={isLoading}
        onRowClick={handleRowClick}
        emptyState={
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <p className="font-semibold text-foreground">{t("noResults")}</p>
            <p className="text-sm text-muted-foreground">Change de date.</p>
          </div>
        }
        mobileCard={(row) => (
          <FixtureMobileCard
            key={row.fixtureId}
            row={row}
            isAdmin={isAdmin}
            selected={selectedId === row.fixtureId}
            onSelect={() => handleRowClick(row)}
          />
        )}
        afterContent={
          <InfiniteScrollSentinel
            onVisible={fetchNextPage}
            disabled={!hasNextPage || isFetchingNextPage || isLoading}
          />
        }
        className="flex-1"
      />

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        direction={isMobile ? "bottom" : "right"}
      >
        <DrawerContent
          className={
            isMobile
              ? "z-50 flex max-h-[92dvh] flex-col rounded-t-[1.6rem] border-t border-border bg-panel-strong focus:outline-none"
              : "z-50 inset-y-3 right-3 flex h-[calc(100dvh-1.5rem)] w-[min(760px,calc(100vw-1.5rem))] flex-col rounded-[1.6rem] border border-border bg-panel-strong shadow-[0_24px_80px_rgba(15,23,42,0.18)] focus:outline-none"
          }
        >
          <DrawerTitle className="sr-only">Diagnostic du match</DrawerTitle>
          <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-10 sm:p-5">
            {selectedRow ? (
              <FixtureDiagnostics row={selectedRow} />
            ) : (
              <div className="flex min-h-80 items-center justify-center rounded-[1.7rem] border border-border bg-panel p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Sélectionne un match pour voir son diagnostic.
                </p>
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
