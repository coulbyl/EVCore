import {
  fixtureStatusLabel,
  fixtureStatusBadgeClass,
} from "../helpers/fixture";

type Locale = "fr" | "en";

export function FixtureStatusBadge({
  status,
  locale = "fr",
}: {
  status: string;
  locale?: Locale;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.08em] ${fixtureStatusBadgeClass(status)}`}
    >
      {fixtureStatusLabel(status, locale)}
    </span>
  );
}
