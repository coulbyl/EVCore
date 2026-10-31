/**
 * How long the public reads stay shared in Next's data cache (16 § 3): the
 * day's hero moves with the evening's settlement, Résultats once a pass.
 * The backend sends the same answers with `s-maxage=300` for a CDN.
 */
export const PUBLIC_TODAY_REVALIDATE_S = 60;
export const PUBLIC_RESULTS_REVALIDATE_S = 300;
/**
 * The landing and the share image do without the hero when the API is slow
 * or unreachable — `next build` prerenders the image and must not hang on
 * it.
 */
export const PUBLIC_TODAY_TIMEOUT_MS = 5_000;
