import { type JSX, type ReactNode } from "react";
import { cn } from "../utils/cn";

export function Code({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <code
      className={cn(
        "font-mono text-[0.78rem] tracking-tight text-slate-700",
        className,
      )}
    >
      {children}
    </code>
  );
}
