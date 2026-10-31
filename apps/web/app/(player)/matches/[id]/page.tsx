import MatchesPage from "../page";

/**
 * Under a match opened from a link: Matchs on today, the sheet comes from
 * the `@sheet` slot.
 */
export default function Page() {
  return <MatchesPage searchParams={Promise.resolve({})} />;
}
