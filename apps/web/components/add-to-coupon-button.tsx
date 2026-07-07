"use client";

import { Plus, Check } from "lucide-react";
import { cn } from "@evcore/ui/cn";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";

/** Small circular add/remove toggle shared by every page that lets a user add
 * a pick to their coupon draft (decisions, investment, …). */
export function AddToCouponButton({ item }: { item: BetSlipDraftItem }) {
  const { draft, addItem, removeItem, isInSlip, open } = useBetSlip();

  const key = draftItemKey(item);
  const inSlip = isInSlip(key);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (inSlip) {
      removeItem(key);
    } else {
      const shouldOpen = draft.items.length === 0;
      addItem(item);
      if (shouldOpen) open();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={inSlip ? "Retirer du coupon" : "Ajouter au coupon"}
      className={cn(
        "flex size-5 items-center justify-center rounded-full border transition-all",
        inSlip
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-background text-muted-foreground hover:border-accent hover:text-accent",
      )}
    >
      {inSlip ? <Check size={10} strokeWidth={3} /> : <Plus size={11} />}
    </button>
  );
}
