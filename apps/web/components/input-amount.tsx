"use client";

import { forwardRef, useEffect, useState } from "react";
import { Input } from "@evcore/ui";

function formatThousands(n: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n);
}

type InputAmountProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value?: number;
  onChange?: (value: number | undefined) => void;
};

export const InputAmount = forwardRef<HTMLInputElement, InputAmountProps>(
  function InputAmount({ value, onChange, onFocus, onBlur, ...props }, ref) {
    const [raw, setRaw] = useState<string>(
      value !== undefined ? String(value) : "",
    );
    const [focused, setFocused] = useState(false);

    // Sync depuis le parent uniquement quand l'utilisateur n'est pas en train de saisir
    useEffect(() => {
      if (!focused) {
        setRaw(value !== undefined ? String(value) : "");
      }
    }, [value, focused]);

    const displayValue = focused
      ? raw
      : value !== undefined
        ? formatThousands(value)
        : "";

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          setRaw(digits);
          onChange?.(digits.length > 0 ? Number(digits) : undefined);
        }}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
      />
    );
  },
);
