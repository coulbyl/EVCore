type Locale = "fr" | "en";

const FIXTURE_STATUS_LABELS: Record<Locale, Record<string, string>> = {
  fr: {
    finished: "Terminé",
    in_progress: "En cours",
    postponed: "Reporté",
    cancelled: "Annulé",
    default: "Planifié",
  },
  en: {
    finished: "Finished",
    in_progress: "In progress",
    postponed: "Postponed",
    cancelled: "Cancelled",
    default: "Scheduled",
  },
};

export function fixtureStatusLabel(
  status: string,
  locale: Locale = "fr",
): string {
  const s = status.toLowerCase();
  const labels = FIXTURE_STATUS_LABELS[locale];
  return labels[s] ?? labels["default"] ?? s;
}

export function fixtureStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "finished") return "border-slate-200 bg-slate-100 text-slate-500";
  if (s === "in_progress") return "border-blue-200 bg-blue-50 text-blue-600";
  if (s === "postponed" || s === "cancelled")
    return "border-rose-200 bg-rose-50 text-rose-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}
