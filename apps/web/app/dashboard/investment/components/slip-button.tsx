"use client";

import { Check, ShoppingCart } from "lucide-react";
import { cn } from "@evcore/ui";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";
import type { InvestmentPickDto } from "@/domains/ai-engine/types/investment";
import { CANAL_COLOR } from "./canal-constants";

export function SlipButton({ pick }: { pick: InvestmentPickDto }) {
  const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();

  if (pick.isCorrect !== null) return null;

  const key = draftItemKey({
    fixtureId: pick.fixtureId,
    market: pick.market,
    pick: pick.pick,
  });
  const inSlip = isInSlip(key);
  const color = CANAL_COLOR[pick.canal];

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(key);
      return;
    }
    const item: BetSlipDraftItem = {
      fixtureId: pick.fixtureId,
      fixture: `${pick.homeTeam} vs ${pick.awayTeam}`,
      homeLogo: pick.homeLogo,
      awayLogo: pick.awayLogo,
      competition: pick.competition,
      scheduledAt: pick.scheduledAt,
      market: pick.market,
      pick: pick.pick,
      odds: pick.oddsSnapshot != null ? pick.oddsSnapshot.toFixed(2) : null,
      ev: null,
      stakeOverride: null,
      ...(pick.betId
        ? { betId: pick.betId }
        : { modelRunId: pick.modelRunId ?? undefined }),
    };
    addItem(item);
    if (draft.items.length === 0) open();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={inSlip ? "Retirer du coupon" : "Ajouter au coupon"}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
        inSlip
          ? "border-success/20 bg-success/12 text-success"
          : "border-border bg-secondary text-muted-foreground hover:text-foreground",
      )}
      style={!inSlip ? { color } : undefined}
    >
      {inSlip ? <Check size={12} /> : <ShoppingCart size={12} />}
    </button>
  );
}
