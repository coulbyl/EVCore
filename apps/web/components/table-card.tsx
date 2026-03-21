"use client";

import type { ReactNode } from "react";
import { SectionHeader } from "@evcore/ui";

export function TableCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.8rem] border border-border bg-panel-strong p-6 ev-shell-shadow">
      <div className="flex items-center justify-between gap-3">
        <SectionHeader title={title} subtitle={subtitle} />
        {action ?? null}
      </div>
      <div className="mt-5 overflow-hidden rounded-[1.3rem] border border-border">
        {children}
      </div>
    </div>
  );
}
