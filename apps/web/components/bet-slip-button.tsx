"use client";

import { ReceiptText } from "lucide-react";
import { usePathname } from "next/navigation";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";

export function BetSlipButton() {
  const { draft, open } = useBetSlip();
  const pathname = usePathname();
  const count = draft.items.length;
  const hiddenOnPage = pathname.startsWith("/dashboard/bet-slips");

  if (hiddenOnPage) return null;

  const hasItems = count > 0;
  const displayCount = count > 9 ? "9+" : count;

  return (
    <>
      {/* Topbar button — always visible */}
      <button
        type="button"
        onClick={open}
        title="Mon coupon"
        className={`relative flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
          hasItems
            ? "border-accent/30 bg-accent/8 text-accent hover:bg-accent/12"
            : "border-border bg-panel-strong text-muted-foreground hover:bg-secondary hover:text-foreground"
        }`}
      >
        <ReceiptText size={16} />
        <span className="hidden sm:inline">Coupon</span>
        {hasItems && (
          <span
            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[0.6rem] font-bold ${
              hasItems
                ? "bg-accent text-accent-foreground"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            {displayCount}
          </span>
        )}
      </button>

      {/* Mobile FAB — only when there are items */}
      {hasItems && (
        <button
          type="button"
          onClick={open}
          className="fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full border border-accent/25 bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground shadow-[0_8px_32px_rgba(15,23,42,0.32)] transition-all sm:hidden"
        >
          <ReceiptText size={15} />
          <span>Mon coupon</span>
          <span className="flex min-w-5 items-center justify-center rounded-full bg-white/18 px-1.5 text-[0.68rem] font-bold">
            {displayCount}
          </span>
        </button>
      )}
    </>
  );
}
