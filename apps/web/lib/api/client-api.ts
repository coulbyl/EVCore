"use client";

import { BACKEND_URL, parseApiError } from "./shared";

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

type ClientApiRequestOptions = {
  body?: BodyInit | object;
  headers?: HeadersInit;
  method?: HttpMethod;
  fallbackErrorMessage?: string;
  cache?: RequestCache;
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

export async function clientApiRequest<T>(
  path: string,
  options?: ClientApiRequestOptions,
): Promise<T> {
  const headers = new Headers(options?.headers);
  let body = options?.body;

  if (body !== undefined && !isBodyInit(body)) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(body);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: options?.method ?? "GET",
    credentials: "include",
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
