import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError } from "@/lib/api/shared";
import { serverApiRequest } from "@/lib/api/server-api";
import type { MatchSheet } from "../types/match-sheet";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One match's sheet, read once per request (server side). An unknown match
 * or an address that is not one (the API answers 400 or 404): not found.
 */
export const getMatchSheet = cache(async (id: string): Promise<MatchSheet> => {
  if (!UUID.test(id)) notFound();
  try {
    return await serverApiRequest<MatchSheet>(
      `/matches/${encodeURIComponent(id)}/sheet`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
});
