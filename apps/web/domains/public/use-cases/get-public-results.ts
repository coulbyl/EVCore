import { cache } from "react";
import { serverApiRequest } from "@/lib/api/server-api";
import { orNotFound } from "@/domains/results/use-cases/get-result-details";
import type {
  AiDetail,
  ProductDetail,
  ResultsPeriod,
  ResultsProductKey,
  ResultsScreen,
} from "@/domains/results/types/results";

/**
 * /resultats (11 § 1): the Résultats tab read without an account, from the
 * public routes and without the visitor's cookies — the same answer for
 * everyone.
 */
export const getPublicResults = cache(
  (period: ResultsPeriod): Promise<ResultsScreen> =>
    serverApiRequest<ResultsScreen>(
      `/public/results/products?period=${period}`,
      { cookieHeader: "" },
    ),
);

export const getPublicProductDetail = cache(
  (product: ResultsProductKey, period: ResultsPeriod): Promise<ProductDetail> =>
    orNotFound(
      serverApiRequest<ProductDetail>(
        `/public/results/products/${product}?period=${period}`,
        { cookieHeader: "" },
      ),
    ),
);

export const getPublicAiDetail = cache(
  (period: ResultsPeriod): Promise<AiDetail> =>
    serverApiRequest<AiDetail>(`/public/results/ai?period=${period}`, {
      cookieHeader: "",
    }),
);
