import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type { MatchItem, MatchesDay, MatchesScreen } from "../types/matches";

/**
 * Pages read for one day. The API serves 60 matches a page and a day
 * reaches 224 (06 § 1): four pages, one more for margin.
 */
const MAX_PAGES = 5;

/**
 * Every match of a day, in screen order, read once per request (server
 * side). The whole day at once: the matches without a reading fold at the
 * bottom of the day, not of a page. `search`: the team search sent with
 * Enter, filtered by the API.
 */
export const getMatchesDay = cache(
  async (
    day: MatchesDay,
    search: string,
  ): Promise<{ date: string; items: MatchItem[] }> => {
    const items: MatchItem[] = [];
    let cursor: string | null = null;
    let date = "";
    for (let page = 0; page < MAX_PAGES; page += 1) {
      const query = new URLSearchParams({ day });
      if (search) query.set("q", search);
      if (cursor) query.set("cursor", cursor);
      const screen: MatchesScreen = await serverApiRequest<MatchesScreen>(
        `/matches?${query.toString()}`,
      );
      date = screen.date;
      items.push(...screen.items);
      cursor = screen.nextCursor;
      if (!cursor) break;
    }
    return { date, items };
  },
);
