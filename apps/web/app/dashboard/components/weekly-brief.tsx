"use client";

import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWeeklyBrief } from "@/domains/dashboard/use-cases/get-weekly-brief";

function isMonday(): boolean {
  return new Date().getDay() === 1;
}

// Le relevé de ce lundi seulement : pas celui d'une semaine passée, resté le
// dernier si le joueur a coupé le relevé ou avant l'envoi de 8 h.
function isThisWeek(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

/**
 * Le point de la semaine, le lundi : le corps du relevé envoyé à 8 h UTC
 * (WEEKLY_STATEMENT). Avant le 2026-10-29 la carte lisait WEEKLY_REPORT,
 * un rapport d'ingénierie filtré pour le joueur, et le filtre de type
 * n'existait pas côté serveur : elle affichait la dernière notification.
 */
export function WeeklyBrief() {
  const t = useTranslations("dashboard.home");
  const { data: brief, isLoading } = useWeeklyBrief();

  if (!isMonday()) return null;
  if (isLoading || !brief || !isThisWeek(brief.createdAt)) return null;

  return (
    <div className="flex items-start gap-3 rounded-[1.35rem] border border-accent/20 bg-accent/5 p-4 ev-shell-shadow sm:p-5">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/15">
        <BookOpen size={16} className="text-accent" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-accent">
          {t("weeklyBriefTitle")}
        </p>
        <p className="text-sm font-medium leading-snug text-foreground">
          {brief.body}
        </p>
      </div>
    </div>
  );
}
