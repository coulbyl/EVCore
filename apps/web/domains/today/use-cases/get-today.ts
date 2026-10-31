import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type { TodayScreen } from "../types/today";

/** « Aujourd'hui » in one answer, read once per request (server side). */
export const getToday = cache(
  (): Promise<TodayScreen> => serverApiRequest<TodayScreen>("/today"),
);
