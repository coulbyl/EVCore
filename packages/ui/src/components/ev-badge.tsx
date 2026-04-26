import { cva, type VariantProps } from "class-variance-authority";
import { type HTMLAttributes } from "react";
import { cn } from "../utils/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.08em]",
  {
    variants: {
      tone: {
        neutral: "border-slate-200 bg-slate-100 text-slate-700",
        accent: "border-blue-200 bg-blue-50 text-blue-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        danger: "border-rose-200 bg-rose-50 text-rose-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

type EvBadgeProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function EvBadge({ className, tone, ...props }: EvBadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
