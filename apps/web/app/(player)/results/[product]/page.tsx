import ResultsPage from "../page";

/** Under a line opened from a link: Résultats, the sheet from `@sheet`. */
export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  return <ResultsPage searchParams={searchParams} />;
}
