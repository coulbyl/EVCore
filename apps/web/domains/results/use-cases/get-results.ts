import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import type { ResultsPeriod, ResultsScreen } from "../types/results";

/** « Résultats » over a period, read once per request (server side). */
export const getResults = cache(
  (period: ResultsPeriod): Promise<ResultsScreen> =>
    serverApiRequest<ResultsScreen>(`/results/products?period=${period}`),
);
