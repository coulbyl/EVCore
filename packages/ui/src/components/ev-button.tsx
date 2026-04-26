"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl border font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      tone: {
        primary: "border-accent bg-accent text-white hover:bg-[#246dc9]",
        secondary: "border-border bg-white text-slate-700 hover:bg-slate-50",
        ghost:
          "border-transparent bg-transparent text-slate-600 hover:bg-slate-100",
      },
      size: {
        xs: "px-2 py-1 text-xs",
        sm: "px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      tone: "primary",
      size: "sm",
    },
  },
);

interface EvButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  className?: string;
}

export const EvButton = ({
  children,
  className,
  tone,
  size,
  type = "button",
  ...props
}: EvButtonProps) => {
  return (
    <button
      className={cn(buttonVariants({ tone, size }), className)}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
};
