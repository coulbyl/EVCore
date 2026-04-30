"use client";

import type { FixtureModelFactors } from "@/domains/fixture/types/fixture";
import { InfoTooltip } from "@/components/info-tooltip";

export type FixtureFactorBarKind = "directional" | "absolute";

export type FixtureFactorDef = {
  key: keyof FixtureModelFactors;
  label: string;
  kind: FixtureFactorBarKind;
  hint: string;
};

function clamp01(v: number): number {
  return Math.min(Math.max(v, 0), 1);
}

export function FixtureFactorBar({
  label,
  value,
  kind,
  hint,
  showDirectionLabels = true,
}: {
  label: string;
  value: number | null;
  kind: FixtureFactorBarKind;
  hint: string;
  showDirectionLabels?: boolean;
}) {
  if (value === null) return null;
  const pct = clamp01(value) * 100;

  if (kind === "absolute") {
    const tone =
      pct <= 33
        ? "var(--color-success)"
        : pct <= 66
          ? "var(--canal-ev)"
          : "var(--color-destructive)";

    return (
      <div className="flex items-center gap-3">
        <div className="flex w-40 shrink-0 items-center gap-1 text-[0.72rem] text-muted-foreground">
          <span>{label}</span>
          <InfoTooltip label={label} description={hint} side="right" />
        </div>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct.toFixed(0)}%`, background: tone }}
          />
        </div>
        <span
          className="w-9 shrink-0 text-right text-[0.72rem] font-semibold tabular-nums"
          style={{ color: tone }}
        >
          {pct.toFixed(0)}%
        </span>
      </div>
    );
  }

  const delta = pct - 50; // <0 => avantage extérieur, >0 => avantage domicile
  const intensity = Math.min(Math.abs(delta) * 2, 100); // distance à 50%, ramenée sur 0..100
  const showFill = intensity >= 8;
  const directionColor =
    delta >= 0
      ? intensity >= 30
        ? "var(--color-success)"
        : "var(--canal-ev)"
      : "var(--color-destructive)";

  return (
    <div className="flex items-center gap-3">
      <div className="flex w-40 shrink-0 items-center gap-1 text-[0.72rem] text-muted-foreground">
        <span>{label}</span>
        <InfoTooltip label={label} description={hint} side="right" />
      </div>

      <div className="flex-1">
        <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px bg-border" />
          <div
            className="absolute top-0 h-full rounded-full transition-all"
            style={
              !showFill
                ? { width: "0%" }
                : delta >= 0
                  ? {
                      left: "50%",
                      width: `${intensity.toFixed(0)}%`,
                      background: directionColor,
                    }
                  : {
                      right: "50%",
                      width: `${intensity.toFixed(0)}%`,
                      background: directionColor,
                    }
            }
          />
        </div>
        {showDirectionLabels && (
          <div className="relative mt-1 text-[0.62rem] text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>
                <span className="sm:hidden">Ext.</span>
                <span className="hidden sm:inline">Extérieur</span>
              </span>
              <span>
                <span className="sm:hidden">Dom.</span>
                <span className="hidden sm:inline">Domicile</span>
              </span>
            </div>
            <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
              Neutre
            </span>
          </div>
        )}
      </div>

      <span className="w-9 shrink-0 text-right text-[0.72rem] font-semibold tabular-nums text-muted-foreground">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}
