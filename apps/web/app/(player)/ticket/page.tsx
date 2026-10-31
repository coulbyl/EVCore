import MatchesPage from "../matches/page";

/** Under « Mon ticket » opened from a link: Matchs, where it is built. */
export default function Page() {
  return <MatchesPage searchParams={Promise.resolve({})} />;
}
