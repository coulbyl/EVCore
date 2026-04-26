import { type HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export function Page({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("w-full px-0 sm:px-1 lg:px-2", className)} {...props} />
  );
}

export function PageHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-4 flex flex-col gap-4 rounded-2xl border border-border bg-panel-strong p-4 sm:mb-5 lg:flex-row lg:items-center lg:justify-between",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeaderTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      className={cn("text-[1.1rem] font-bold text-foreground", className)}
      {...props}
    />
  );
}

export function PageHeaderActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2 sm:gap-3", className)}
      {...props}
    />
  );
}

export function PageContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-panel-strong p-4 sm:p-5",
        className,
      )}
      {...props}
    />
  );
}
