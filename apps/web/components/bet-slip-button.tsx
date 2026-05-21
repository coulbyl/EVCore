"use client";

import { ReceiptText } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@evcore/ui/cn";
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
      {/* Topbar button */}
      <button
        type="button"
        onClick={open}
        title="Mon coupon"
        className={cn(
          "relative flex size-9 items-center justify-center rounded-xl border text-sm font-semibold transition-colors md:size-auto md:min-h-11 md:gap-2 md:px-3",
          hasItems
            ? "border-accent/30 bg-accent/8 text-accent hover:bg-accent/12"
            : "border-border bg-panel-strong text-muted-foreground hover:bg-secondary hover:text-foreground",
        )}
      >
        <ReceiptText size={16} />
        {hasItems && (
          <span
            className={cn(
              "absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[0.58rem] font-bold",
              "bg-accent text-accent-foreground",
              "md:static md:h-5 md:min-w-5 md:text-[0.6rem]",
            )}
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
