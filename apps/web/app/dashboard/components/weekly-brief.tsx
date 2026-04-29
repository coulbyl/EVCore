"use client";

import { BookOpen } from "lucide-react";
import { useWeeklyBrief } from "@/domains/dashboard/use-cases/get-weekly-brief";

function isMonday(): boolean {
  return new Date().getDay() === 1;
}

export function WeeklyBrief() {
  const { data: brief, isLoading } = useWeeklyBrief();

  if (!isMonday()) return null;
  if (isLoading || !brief) return null;

  const narrative =
    (brief.payload?.narrative as string | undefined) ?? brief.body.split("\n")[0] ?? brief.title;

  const roiOneXTwo = brief.payload?.roiOneXTwo;
  const positive = roiOneXTwo !== undefined ? roiOneXTwo >= 0 : false;

  return (
    <div className="flex items-start gap-3 rounded-[1.35rem] border border-accent/20 bg-accent/5 p-4 ev-shell-shadow sm:p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15">
        <BookOpen size={16} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-accent">
          Brief de la semaine
        </p>
        <p className="text-sm font-medium leading-snug text-foreground">
          {narrative}
        </p>
        {roiOneXTwo !== undefined && (
          <p
            className={`mt-1 text-[0.72rem] font-bold tabular-nums ${
              positive ? "text-success" : "text-danger"
            }`}
          >
            ROI 1X2 :{" "}
            {roiOneXTwo >= 0 ? "+" : ""}
            {(roiOneXTwo * 100).toFixed(1)} %
          </p>
        )}
      </div>
    </div>
  );
}
