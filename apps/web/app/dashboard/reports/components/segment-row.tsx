"use client";

import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SegmentReportRow } from "@/domains/reports/types/reports";
import { VERDICT_META, fmtDateTime, fmtNum, fmtPct } from "./reports-constants";

function Metric({
  label,
  baseline,
  corrected,
  delta,
}: {
  label: string;
  baseline: string;
  corrected: string;
  delta?: { value: number; good: boolean } | null;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-sm tabular-nums">
        {baseline} <span className="text-muted-foreground">→</span> {corrected}
        {delta ? (
          <span
            className={
              delta.good ? "ml-1 text-success" : "ml-1 text-destructive"
            }
          >
            {fmtPct(delta.value)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function SegmentRow({ row }: { row: SegmentReportRow }) {
  const [open, setOpen] = useState(false);
  const meta = VERDICT_META[row.verdict];
  const c = row.comparison;
  const model = row.activeModel;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm">{row.segment}</span>
          <Badge variant={meta.variant} className="text-[0.65rem]">
            {meta.label}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Réduire" : "Détails"}
        >
          {open ? (
            <ChevronUp className="size-4" />
          ) : (
            <ChevronDown className="size-4" />
          )}
        </Button>
      </div>

      {c ? (
        <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Metric
            label="Échantillon"
            baseline={`${c.sampleSize}`}
            corrected="settlés"
          />
          <Metric
            label="Brier (base → corr)"
            baseline={fmtNum(c.baselineBrier)}
            corrected={fmtNum(c.correctedBrier)}
            delta={
              row.brierImprovement !== null
                ? {
                    value: row.brierImprovement,
                    good: row.brierImprovement > 0,
                  }
                : null
            }
          />
          <Metric
            label="ROI (base → corr)"
            baseline={fmtPct(c.baselineRoi)}
            corrected={fmtPct(c.correctedRoi)}
            delta={
              c.correctedRoi !== null
                ? {
                    value: c.correctedRoi - c.baselineRoi,
                    good: c.correctedRoi >= c.baselineRoi,
                  }
                : null
            }
          />
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{meta.hint}</p>
      )}

      {open ? (
        <div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">
          {model ? (
            <div className="flex flex-col gap-1">
              <span>
                Modèle actif :{" "}
                <span className="font-mono">{model.algorithm}</span> · activé{" "}
                {fmtDateTime(model.activatedAt)}
              </span>
              <span>
                Brier (entraînement) : {fmtNum(model.brierScore)} · ROI shadow :{" "}
                {fmtPct(model.roiShadow)}
                {model.roiShadowLegacy ? (
                  <span className="ml-1 text-warning">
                    (définition pré-2026-06-11, non comparable)
                  </span>
                ) : null}
              </span>
            </div>
          ) : (
            <span>Aucun modèle actif pour ce segment.</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
