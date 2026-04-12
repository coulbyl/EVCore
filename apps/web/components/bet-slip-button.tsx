import { ShoppingCart } from "lucide-react";
import { useBetSlip } from "@/domains/bet-slip/context/bet-slip-context";

export function BetSlipButton() {
  const { draft, open } = useBetSlip();
  const count = draft.items.length;

  return (
    <button
      type="button"
      onClick={open}
      className="relative flex min-h-11 min-w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700"
      title="Panier"
    >
      <ShoppingCart size={18} />
      {count > 0 && (
        <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[0.55rem] font-bold text-white">
          {count}
        </span>
      )}
    </button>
  );
}