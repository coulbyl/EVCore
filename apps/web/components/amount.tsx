"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@evcore/ui";
import { useCurrencyFormat } from "@/providers/currency-provider";
import { numberToFrench } from "@/helpers/number-to-words";

interface AmountProps {
  value: number | string;
  signed?: boolean;
  className?: string;
}

export function Amount({ value, signed = false, className }: AmountProps) {
  const { formatAmount, formatSigned } = useCurrencyFormat();
  const n = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(n)) {
    return <span className={className}>—</span>;
  }

  const display = signed ? formatSigned(n) : formatAmount(n);
  const words = numberToFrench(n);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`tabular-nums cursor-pointer underline decoration-dotted underline-offset-2 hover:decoration-solid ${className ?? ""}`}
        >
          {display}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto max-w-64 p-3" align="start" side="top">
        <p className="text-xs text-muted-foreground first-letter:capitalize">
          {words}
        </p>
      </PopoverContent>
    </Popover>
  );
}
