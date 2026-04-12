"use client";

import { clientApiRequest } from "@/lib/api/client-api";

type RequestOptions = {
  body?: BodyInit | object;
  method?: "GET" | "POST" | "PATCH";
  fallbackErrorMessage?: string;
};

export async function authRequest<T>(path: string, options?: RequestOptions) {
  return clientApiRequest<T>(path, {
    method: options?.method ?? "POST",
    body: options?.body,
    fallbackErrorMessage:
      options?.fallbackErrorMessage ?? "Une erreur est survenue.",
  });
}
