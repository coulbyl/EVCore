import { MatchSheetView } from "../../../matches/components/match-sheet";

/** A match of Matchs opened by a tap (06 § 2). */
export default async function InterceptedMatchSheet({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchSheetView id={id} />;
}
