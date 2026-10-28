"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { DataTable, type ColumnDef } from "@evcore/ui";
import type { ChannelStatus } from "@/domains/dashboard/types/dashboard";
import {
  formatCount,
  formatRate,
  formatSignedRate,
} from "../track-record-constants";
import { CalibrationVerdict } from "./calibration-verdict";

export type ChannelStatRow = {
  key: string;
  primaryLabel: string;
  secondaryLabel?: string;
  status: ChannelStatus;
  /** Probabilité moyenne annoncée, 0–1. */
  announced: number | null;
  /** Taux réellement passé, 0–1. */
  realised: number | null;
  /** Réalisé ÷ annoncé, porte le sens du verdict. */
  calibrationRatio: number | null;
  /** En points, comme le renvoie le backend (−4,8 pour −4,8 %). */
  roi: number | null;
  sampleSize: number;
};

/** One shared TanStack column model drives both the desktop table and the
 * mobile card list via DataTable's `mobileCard` prop — see CLAUDE.md
 * (TanStack Table): "Do not hardcode mobile/desktop table variants
 * separately when one shared table model can drive both."
 *
 * Annoncé et réalisé côte à côte, comme l'en-tête de la page : l'ancien
 * ratio « 0.84× » se lisait comme une cote sur téléphone. Le résultat à mise
 * fixe reste affiché en gris mais n'est pas triable : trié, il redevenait un
 * classement des canaux par gain (audit UX du 2026-10-27). */
export function ChannelStatsTable({
  primaryColumnLabel,
  rows,
  countNoun,
  keepRowOrder = false,
}: {
  primaryColumnLabel: string;
  rows: ChannelStatRow[];
  /** Pied du tableau : « 4 canaux » plutôt que « 4 résultats ». Des chaînes,
   * pas une fonction : la page serveur ne peut pas passer de fonction à ce
   * composant client. */
  countNoun?: { one: string; other: string };
  /** Garder l'ordre reçu (Santé moteur trie par écart) au lieu de trier par
   * nombre de réglés. */
  keepRowOrder?: boolean;
}) {
  const locale = useLocale();
  const columns: ColumnDef<ChannelStatRow>[] = useMemo(
    () => [
      {
        id: "primary",
        header: primaryColumnLabel,
        accessorFn: (row) => row.primaryLabel,
        cell: ({ row }) => (
          <span className="font-medium text-foreground">
            {row.original.primaryLabel}
            {row.original.secondaryLabel ? (
              <span className="ml-1.5 font-normal text-muted-foreground">
                · {row.original.secondaryLabel}
              </span>
            ) : null}
          </span>
        ),
      },
      {
        id: "announced",
        header: "Annoncé",
        accessorFn: (row) => row.announced ?? Number.NEGATIVE_INFINITY,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatRate(row.original.announced, locale)}
          </span>
        ),
      },
      {
        id: "realised",
        header: "Réalisé",
        accessorFn: (row) => row.realised ?? Number.NEGATIVE_INFINITY,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatRate(row.original.realised, locale)}
          </span>
        ),
      },
      {
        id: "verdict",
        header: "Lecture",
        cell: ({ row }) => (
          <CalibrationVerdict
            status={row.original.status}
            ratio={row.original.calibrationRatio}
          />
        ),
      },
      {
        id: "sampleSize",
        header: "Réglés",
        accessorFn: (row) => row.sampleSize,
        enableSorting: true,
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatCount(row.original.sampleSize, locale)}
          </span>
        ),
      },
      {
        id: "roi",
        header: "À mise fixe",
        meta: { align: "right" },
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {formatSignedRate(
              row.original.roi === null ? null : row.original.roi / 100,
              locale,
            )}
          </span>
        ),
      },
    ],
    [primaryColumnLabel, locale],
  );

  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={keepRowOrder ? [] : [{ id: "sampleSize", desc: true }]}
      countLabel={
        countNoun
          ? (count) => `${count} ${count > 1 ? countNoun.other : countNoun.one}`
          : undefined
      }
      mobileCard={(row) => (
        // Rangée séparée, pas une carte : la page est déjà un panneau, des
        // cartes dedans s'empilaient (détecteur impeccable, nested-cards).
        <div className="border-b border-border pb-3 pt-1 last:border-b-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-foreground">
              {row.primaryLabel}
              {row.secondaryLabel ? (
                <span className="block font-normal text-muted-foreground">
                  {row.secondaryLabel}
                </span>
              ) : null}
            </p>
            <CalibrationVerdict
              status={row.status}
              ratio={row.calibrationRatio}
              className="shrink-0"
            />
          </div>
          <p className="mt-2.5 text-sm tabular-nums text-muted-foreground">
            Annoncé {formatRate(row.announced, locale)} · réalisé{" "}
            <span className="font-semibold text-foreground">
              {formatRate(row.realised, locale)}
            </span>
          </p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {formatCount(row.sampleSize, locale)} réglés · à mise fixe{" "}
            {formatSignedRate(row.roi === null ? null : row.roi / 100, locale)}
          </p>
        </div>
      )}
    />
  );
}
