import { fixtureStatusBadgeClass, fixtureStatusLabel } from "@/helpers/fixture";

// Scheduled and finished are already conveyed by the kickoff time and the
// score in the card header — only surface states that would otherwise be
// invisible (a match that got postponed, cancelled, or is live right now).
const SURFACED_STATUSES = new Set(["in_progress", "postponed", "cancelled"]);

export function FixtureStatusBadge({
  status,
  locale,
}: {
  status: string;
  locale: string;
}) {
  const normalized = status.toLowerCase();
  if (!SURFACED_STATUSES.has(normalized)) return null;

  const loc = locale === "en" ? "en" : "fr";
  return (
    <span
      className={`ml-1.5 inline-flex shrink-0 items-center rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${fixtureStatusBadgeClass(status)}`}
    >
      {fixtureStatusLabel(status, loc)}
    </span>
  );
}
