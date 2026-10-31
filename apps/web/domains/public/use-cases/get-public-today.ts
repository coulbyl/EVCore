import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type { PublicToday } from "../types/public";

/**
 * The landing's hero and results (GET /public/today), without the
 * visitor's cookies: the same answer for everyone. Null when the server
 * does not answer: the landing still shows its line, its button and its
 * footer.
 */
export const getPublicToday = cache(async (): Promise<PublicToday | null> => {
  try {
    return await serverApiRequest<PublicToday>("/public/today", {
      cookieHeader: "",
    });
  } catch {
    return null;
  }
});
