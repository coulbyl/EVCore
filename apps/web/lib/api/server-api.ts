import { cookies } from "next/headers";
import { BACKEND_URL, parseApiError } from "./shared";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type ServerApiRequestOptions = {
  body?: BodyInit | object;
  headers?: HeadersInit;
  method?: HttpMethod;
  fallbackErrorMessage?: string;
  cache?: RequestCache;
  cookieHeader?: string;
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

  const cookieHeader = options?.cookieHeader ?? (await getCookieHeader());
  if (cookieHeader) {
    headers.set("cookie", cookieHeader);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: options?.method ?? "GET",
    cache: options?.cache ?? "no-store",
    headers: hasHeaders(headers) ? headers : undefined,
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
