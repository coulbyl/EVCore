"use client";

import { useState, useEffect } from "react";
import {
  Button,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";

type AppPageHeaderProps = {
  currentPageLabel: string;
  subtitle: string;
  backendLabel: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
};

export function AppPageHeader({
  currentPageLabel,
  subtitle,
  backendLabel,
  onRefresh,
  isRefreshing = false,
}: AppPageHeaderProps) {
  const [todayLabel, setTodayLabel] = useState<string>("");
  useEffect(() => {
    setTodayLabel(
      new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    );
  }, []);

  return (
    <PageHeader className="sticky top-0 z-20 mb-4 shrink-0 backdrop-blur supports-[backdrop-filter]:bg-panel-strong/95">
      <div>
        <div className="flex items-center gap-3">
          <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Console
          </span>
          <span className="text-sm text-slate-300">/</span>
          <span className="text-sm font-medium text-slate-500">
            {currentPageLabel}
          </span>
        </div>
        <PageHeaderTitle className="mt-3 text-[2rem] font-semibold tracking-tight text-slate-900">
          Console EVCore
        </PageHeaderTitle>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <PageHeaderActions className="text-sm text-slate-500">
        <span>{todayLabel}</span>
        <span className="text-slate-300">|</span>
        <span className="font-medium text-slate-700">
          Backend : {backendLabel}
        </span>
        <Button tone="secondary" onClick={onRefresh}>
          {isRefreshing ? "Chargement..." : "Rafraîchir"}
        </Button>
      </PageHeaderActions>
    </PageHeader>
  );
}
