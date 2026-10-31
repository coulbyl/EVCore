import { ResultsSheet } from "../../../results/components/results-sheet";
import { periodOf } from "../../../results/components/results-constants";

/** A line of Résultats opened (08 § 2), the same on a tap and on a link. */
export default async function ResultsSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ product: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  const [{ product }, query] = await Promise.all([params, searchParams]);
  return <ResultsSheet slug={product} period={periodOf(query.period)} />;
}
