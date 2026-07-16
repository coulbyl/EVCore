import type { ReactNode } from "react";

export function SettingsSectionCard({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow?: string;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[1.6rem] border border-border bg-panel-strong p-5 ev-shell-shadow ${className ?? ""}`}
    >
      {eyebrow ? (
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          {eyebrow}
        </p>
      ) : null}
      {title ? (
        <h3
          className={`text-base font-semibold tracking-tight text-foreground ${eyebrow ? "mt-2" : ""}`}
        >
          {title}
        </h3>
      ) : null}
      {description ? (
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
