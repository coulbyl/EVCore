import { type JSX, type ReactNode } from "react";
import { cn } from "../utils/cn";

export function FeatureCard({
  className,
  title,
  children,
  href,
}: {
  className?: string;
  title: string;
  children: ReactNode;
  href?: string;
}): JSX.Element {
  const content = (
    <>
      <h2 className="text-base font-semibold text-slate-800">
        {title} <span className="text-slate-400">-&gt;</span>
      </h2>
      <p className="mt-2 text-sm text-slate-600">{children}</p>
    </>
  );

  const classes = cn(
    "block rounded-2xl border border-border bg-white p-5 transition-colors hover:bg-slate-50",
    className,
  );

  if (!href) {
    return <div className={classes}>{content}</div>;
  }

  return (
    <a className={classes} href={href}>
      {content}
    </a>
  );
}
