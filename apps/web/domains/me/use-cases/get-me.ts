import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type { MeScreen, MeSettledPage } from "../types/me";

/** Moi's first level in one answer (09 § 1), read once per request. */
export const getMe = cache(
  (): Promise<MeScreen> => serverApiRequest<MeScreen>("/me"),
);

/** « Voir plus » under Réglés: the next page after `cursor`. */
export const getMeSettled = cache(
  (cursor: string): Promise<MeSettledPage> =>
    serverApiRequest<MeSettledPage>(
      `/me/settled?cursor=${encodeURIComponent(cursor)}`,
    ),
);
