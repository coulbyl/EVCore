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

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="relative min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:flex"
        title="Mon ticket"
      >
        <ReceiptText size={18} />
        {count > 0 && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[0.55rem] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {/* <button
        type="button"
        onClick={open}
        className="fixed right-4 bottom-24 z-30 flex min-h-12 items-center gap-2 rounded-full bg-slate-950 px-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(15,23,42,0.28)] sm:hidden"
      >
        <ReceiptText size={16} />
        <span>Mon ticket</span>
        <span className="flex min-w-6 items-center justify-center rounded-full bg-white/14 px-1.5 py-0.5 text-[0.68rem] font-bold">
          {count}
        </span>
      </button> */}
    </>
  );
}
