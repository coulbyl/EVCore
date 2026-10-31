import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import {
  PUBLIC_TODAY_REVALIDATE_S,
  PUBLIC_TODAY_TIMEOUT_MS,
} from "../public-cache";
import type { PublicToday } from "../types/public";

/**
 * The landing's hero and results (GET /public/today), without the
 * visitor's cookies: the same answer for everyone, shared for a minute.
 * Null when the server does not answer: the landing still shows its line,
 * its button and its footer.
 */
export const getPublicToday = cache(async (): Promise<PublicToday | null> => {
  try {
    return await serverApiRequest<PublicToday>("/public/today", {
      cookieHeader: "",
      revalidate: PUBLIC_TODAY_REVALIDATE_S,
      timeoutMs: PUBLIC_TODAY_TIMEOUT_MS,
    });
  } catch {
    return null;
  }
});
