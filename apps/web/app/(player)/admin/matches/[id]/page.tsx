import { permanentRedirect } from "next/navigation";

/**
 * The analysis of a match moved to the players' Matchs on 04/11
 * (`/matches/[id]/analysis`): an old admin link still lands on it.
 */
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/matches/${encodeURIComponent(id)}/analysis`);
}
