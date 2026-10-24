"use client";

import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useWeeklyBrief } from "@/domains/dashboard/use-cases/get-weekly-brief";

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(text: string): string {
  const match = /^(.{20,}?[.!?])(\s|$)/.exec(text);
  return match?.[1] ?? text;
}

function isMonday(): boolean {
  return new Date().getDay() === 1;
}

export function WeeklyBrief() {
  const t = useTranslations("dashboard.home");
  const { data: brief, isLoading } = useWeeklyBrief();

  if (!isMonday()) return null;
  if (isLoading || !brief) return null;

  // Le corps d'une annonce est du HTML rédigé dans l'éditeur admin : affiché
  // tel quel, un utilisateur lisait « <p>Vous connaissez déjà… <strong> ».
  // On n'en garde que le texte, et la première phrase.
  const narrative = firstSentence(
    stripHtml(
      (brief.payload?.narrative as string | undefined) ??
        brief.body.split("\n")[0] ??
        brief.title,
    ),
  );

  // Plus de ligne « ROI 1X2 » : un ROI sans période ni effectif, coloré en
  // vert ou rouge, contredisait les règles de rédaction (apps/web/PRODUCT.md)
  // et le dépôt lui-même (aucune puissance à ces volumes).

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
          {narrative}
        </p>
      </div>
    </div>
  );
}
