"use client";

import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import { RotateCcw } from "lucide-react";
import { useSettleChannelDecisionsRange } from "@/domains/channel-decision/use-cases/use-channel-decisions";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ChannelSelectionSettlementSection() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [result, setResult] = useState<{
    fixturesResettled: number;
    selectionsResettled: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useSettleChannelDecisionsRange();

  async function handleTrigger() {
    setResult(null);
    setError(null);
    try {
      const r = await trigger.mutateAsync({ from, to });
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inconnue");
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <RotateCcw size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Rattrapage settlement picks (channel selections)
        </p>
      </div>
      <div className="bento-cell flex flex-col gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
            <RotateCcw size={16} />
          </span>
          <div>
            <p className="font-semibold text-foreground">
              Rattrapage picks — plage de dates
            </p>
            <p className="text-xs text-muted-foreground">
              Force le re-règlement du résultat gagné/perdu de tous les picks
              (channel selections) dont le match a eu lieu dans la plage —
              indépendant des coupons. Sans effet si le résultat était déjà
              correct.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] font-medium text-muted-foreground">
              Du
            </label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 rounded-xl border border-border bg-panel px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[0.65rem] font-medium text-muted-foreground">
              Au
            </label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 rounded-xl border border-border bg-panel px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTrigger}
            disabled={trigger.isPending || !from || !to}
          >
            {trigger.isPending ? "En cours…" : "Rejouer le règlement"}
          </Button>
        </div>
        {result && (
          <Badge variant="success" className="w-fit text-[0.65rem]">
            {result.fixturesResettled} match
            {result.fixturesResettled !== 1 ? "s" : ""} passé
            {result.fixturesResettled !== 1 ? "s" : ""} en revue —{" "}
            {result.selectionsResettled} pick
            {result.selectionsResettled !== 1 ? "s" : ""} re-réglé
            {result.selectionsResettled !== 1 ? "s" : ""}
          </Badge>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>
    </section>
  );
}
