"use client";

import { useState, useEffect } from "react";
import {
  Button,
  PageHeader,
  PageHeaderActions,
  PageHeaderTitle,
} from "@evcore/ui";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const isMobile = useIsMobile();

  useEffect(() => {
    setTodayLabel(
      new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    );
  }, []);

  const apiLive =
    backendLabel.trim().toLowerCase() !== "indisponible" &&
    backendLabel.trim().toLowerCase() !== "off";

  return (
    <PageHeader
      className={`sticky top-0 z-20 shrink-0 backdrop-blur supports-[backdrop-filter]:bg-panel-strong/95 ${
        isMobile ? "mb-3 rounded-[1.45rem] px-4 py-3" : "mb-4"
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex rounded-full border border-slate-200 bg-slate-50 font-semibold uppercase text-slate-500 ${
              isMobile
                ? "px-2.5 py-1 text-[0.6rem] tracking-[0.2em]"
                : "px-2 py-1 text-[0.68rem] tracking-[0.18em]"
            }`}
          >
            Console
          </span>
          {!isMobile ? (
            <>
              <span className="text-sm text-slate-300">/</span>
              <span className="text-sm font-medium text-slate-500">
                {currentPageLabel}
              </span>
            </>
          ) : null}
        </div>
        <PageHeaderTitle
          className={`font-semibold tracking-tight text-slate-900 ${
            isMobile
              ? "mt-3 text-[1.05rem] leading-tight"
              : "mt-3 text-[1.45rem] sm:text-[1.7rem] lg:text-[2rem]"
          }`}
        >
          {isMobile ? currentPageLabel : "Console EVCore"}
        </PageHeaderTitle>
        {!isMobile ? (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        ) : null}
      </div>
      <PageHeaderActions
        className={`text-slate-500 ${isMobile ? "gap-x-2 gap-y-1 text-xs" : "text-sm"}`}
      >
        <span
          className={`order-1 inline-flex items-center gap-2 font-medium ${isMobile ? "rounded-full bg-slate-50 px-2 py-1" : "sm:order-none"}`}
        >
          <span
            className={`size-2 rounded-full ${
              apiLive ? "animate-pulse bg-emerald-500" : "bg-rose-500"
            }`}
          />
          <span className="text-slate-700">
            {apiLive ? "API live" : "API off"}
          </span>
        </span>
        {!isMobile ? <span className="text-slate-300">|</span> : null}
        <span
          className={`order-3 ${isMobile ? "text-[0.72rem] text-slate-400" : "order-2 sm:order-none"}`}
        >
          {todayLabel}
        </span>
        <Button
          tone="secondary"
          size={isMobile ? "xs" : "sm"}
          className={
            isMobile ? "order-2 ml-auto rounded-full px-3" : "ml-auto sm:ml-0"
          }
          onClick={onRefresh}
        >
          {isRefreshing ? "Chargement..." : "Rafraîchir"}
        </Button>
      </PageHeaderActions>
    </PageHeader>
  );
}
