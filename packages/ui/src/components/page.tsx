import { type HTMLAttributes } from "react";
import { cn } from "../utils/cn";

export function Page({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("w-full px-2", className)} {...props} />;
}

export function PageHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "mb-5 flex items-center justify-between rounded-2xl border border-border bg-panel-strong p-4",
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
      className={cn("text-[1.1rem] font-bold text-slate-900", className)}
      {...props}
    />
  );
}

export function PageHeaderActions({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center gap-3", className)} {...props} />
  );
}

export function PageContent({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-panel-strong p-4",
        className,
      )}
      {...props}
    />
  );
}
