"use client";

import { Plus, Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@evcore/ui/cn";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";
import {
  draftItemKey,
  type BetSlipDraftItem,
} from "@/domains/bet-slip/types/bet-slip";

/** Small circular add/remove toggle shared by every page that lets a user add
 * a pick to their coupon draft. */
export function AddToCouponButton({ item }: { item: BetSlipDraftItem }) {
  const t = useTranslations("couponCard");
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
      aria-label={inSlip ? t("removeFromCoupon") : t("addToCoupon")}
      // Zone de tap de 44 px (size-11) autour d'un rond visuel de 24 px ; la
      // marge négative garde l'encombrement d'origine dans les cartes.
      className="group -m-2.5 flex size-11 shrink-0 items-center justify-center"
    >
      <span
        className={cn(
          "flex size-6 items-center justify-center rounded-full border transition-all",
          inSlip
            ? "border-accent bg-accent text-accent-foreground"
            : "border-border bg-background text-muted-foreground group-hover:border-accent group-hover:text-accent",
        )}
      >
        {inSlip ? <Check size={12} strokeWidth={3} /> : <Plus size={13} />}
      </span>
    </button>
  );
}
