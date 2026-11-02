import { cookies, headers as requestHeaders } from "next/headers";
import { BACKEND_URL, parseApiError } from "./shared";

/**
 * Where the server reaches the API. In production the web and the backend
 * share a Docker network: `API_INTERNAL_URL` (http://backend:3000, set in the
 * compose) skips the public proxy, DNS and TLS on every server read. Read at
 * runtime, never inlined; the public address serves when it is unset (dev,
 * e2e, build-time renders).
 */
const SERVER_BACKEND_URL = process.env.API_INTERNAL_URL ?? BACKEND_URL;

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type ServerApiRequestOptions = {
  body?: BodyInit | object;
  headers?: HeadersInit;
  method?: HttpMethod;
  fallbackErrorMessage?: string;
  cache?: RequestCache;
  cookieHeader?: string;
  /**
   * Seconds the answer stays in Next's data cache, shared by every request:
   * only for reads sent without the visitor's cookies (the public routes).
   */
  revalidate?: number;
  /** Gives up after this many milliseconds (a read that has a fallback). */
  timeoutMs?: number;
};

function hasHeaders(headers: Headers): boolean {
  return Array.from(headers.keys()).length > 0;
}

function isBodyInit(value: BodyInit | object): value is BodyInit {
  return (
    typeof value === "string" ||
    value instanceof FormData ||
    value instanceof URLSearchParams ||
    value instanceof Blob ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value)
  );
}

async function getCookieHeader(): Promise<string> {
  const cookieStore = await cookies();

  return cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

export async function serverApiRequest<T>(
  path: string,
  options?: ServerApiRequestOptions,
): Promise<T> {
  const headers = new Headers(options?.headers);
  let body = options?.body;

  if (body !== undefined && !isBodyInit(body)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  // A read for the visitor carries the visitor's address: behind the web
  // server, the API's rate limit would otherwise count every player as one
  // client. The proxy's header is forwarded as is — the backend trusts one
  // hop and reads its last entry, the address the proxy saw. Public reads
  // (cookieHeader given) stay cacheable and read no request header.
  if (options?.cookieHeader === undefined) {
    const forwardedFor = (await requestHeaders()).get("x-forwarded-for");
    if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  }
  const cookieHeader = options?.cookieHeader ?? (await getCookieHeader());
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${SERVER_BACKEND_URL}${path}`, {
    method: options?.method ?? "GET",
    ...(options?.revalidate !== undefined && !cookieHeader
      ? { next: { revalidate: options.revalidate } }
      : { cache: options?.cache ?? "no-store" }),
    headers: hasHeaders(headers) ? headers : undefined,
    signal:
      options?.timeoutMs !== undefined
        ? AbortSignal.timeout(options.timeoutMs)
        : undefined,
    body,
  });

  if (!response.ok) {
    throw await parseApiError(
      response,
      options?.fallbackErrorMessage ??
        `Une erreur est survenue (${response.status}).`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
