import { MatchSheetView } from "../../../matches/components/match-sheet";

/**
 * The same sheet on a shared link or a reload: no interception then, the
 * slot renders it over Matchs (`matches/[id]`).
 */
export default async function MatchSheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchSheetView id={id} />;
}
