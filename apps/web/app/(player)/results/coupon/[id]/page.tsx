import ResultsPage from "../../page";

/** Under a settled coupon opened from a link: Résultats. */
export default function Page() {
  return <ResultsPage searchParams={Promise.resolve({})} />;
}
