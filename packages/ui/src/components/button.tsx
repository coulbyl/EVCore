"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../utils/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl border text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      tone: {
        primary:
          "border-accent bg-accent px-4 py-2 text-white hover:bg-[#246dc9]",
        secondary:
          "border-border bg-white px-4 py-2 text-slate-700 hover:bg-slate-50",
        ghost:
          "border-transparent bg-transparent px-3 py-2 text-slate-600 hover:bg-slate-100",
      },
    },
    defaultVariants: {
      tone: "primary",
    },
  },
);

interface ButtonProps
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  children: ReactNode;
  className?: string;
}

export const Button = ({
  children,
  className,
  tone,
  type = "button",
  ...props
}: ButtonProps) => {
  return (
    <button
      className={cn(buttonVariants({ tone }), className)}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
};
