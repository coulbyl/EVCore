"use client";

import { useState } from "react";
import { Badge, Button } from "@evcore/ui";
import { CheckCircle2, RotateCcw } from "lucide-react";
import {
  useSettleCoupon,
  useSettleCouponRange,
} from "@/domains/coupon/use-cases/use-coupons";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function RangeSettleCard() {
  const [from, setFrom] = useState(today());
  const [to, setTo] = useState(today());
  const [result, setResult] = useState<{ resettled: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trigger = useSettleCouponRange();

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
    <div className="bento-cell flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
          <RotateCcw size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">
            Rattrapage coupons — plage de dates
          </p>
          <p className="text-xs text-muted-foreground">
            Force le re-règlement de toutes les proposals (peu importe leur
            statut, y compris EXPIRED) dont la date est dans la plage. Sans
            effet si le résultat était déjà correct.
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
          {result.resettled} proposal{result.resettled !== 1 ? "s" : ""}{" "}
          repassée{result.resettled !== 1 ? "s" : ""}
        </Badge>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

function SingleSettleCard() {
  const [proposalId, setProposalId] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; error?: string } | null>(
    null,
  );
  const trigger = useSettleCoupon();

  async function handleTrigger() {
    setStatus(null);
    try {
      await trigger.mutateAsync(proposalId.trim());
      setStatus({ ok: true });
    } catch (err) {
      setStatus({
        ok: false,
        error: err instanceof Error ? err.message : "Erreur inconnue",
      });
    }
  }

  return (
    <div className="bento-cell flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-xl border border-border bg-secondary text-accent">
          <RotateCcw size={16} />
        </span>
        <div>
          <p className="font-semibold text-foreground">
            Rattrapage coupon — ID précis
          </p>
          <p className="text-xs text-muted-foreground">
            Re-règle une proposal précise si tu as déjà son UUID.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[0.65rem] font-medium text-muted-foreground">
            Proposal ID
          </label>
          <input
            type="text"
            value={proposalId}
            onChange={(e) => setProposalId(e.target.value)}
            placeholder="019f5d47-b8fb-…"
            className="h-9 w-72 rounded-xl border border-border bg-panel px-3 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTrigger}
          disabled={trigger.isPending || !proposalId.trim()}
        >
          {trigger.isPending ? "En cours…" : "Rejouer"}
          {status?.ok && (
            <CheckCircle2 size={12} className="ml-1 text-success" />
          )}
        </Button>
      </div>
      {status?.error && <p className="text-xs text-danger">{status.error}</p>}
    </div>
  );
}

export function CouponSettlementSection() {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <RotateCcw size={14} className="text-accent" />
        <p className="text-[0.72rem] font-semibold uppercase tracking-widest text-muted-foreground">
          Rattrapage settlement coupons
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RangeSettleCard />
        <SingleSettleCard />
      </div>
    </section>
  );
}
