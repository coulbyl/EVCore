export function fixtureStatusLabel(status: string): string {
  const s = status.toLowerCase();
  if (s === "finished") return "terminé";
  if (s === "in_progress") return "en cours";
  if (s === "postponed") return "reporté";
  if (s === "cancelled") return "annulé";
  return "planifié";
}

export function fixtureStatusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === "finished")
    return "border-slate-200 bg-slate-100 text-slate-500";
  if (s === "in_progress")
    return "border-blue-200 bg-blue-50 text-blue-600";
  if (s === "postponed" || s === "cancelled")
    return "border-rose-200 bg-rose-50 text-rose-600";
  return "border-amber-200 bg-amber-50 text-amber-700";
}
