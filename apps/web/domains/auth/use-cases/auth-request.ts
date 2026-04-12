"use client";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type RequestOptions = {
  body?: unknown;
  method?: "GET" | "POST";
};

function extractFirstErrorMessage(value: unknown): string | null {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const nested = extractFirstErrorMessage(item);
      if (nested) {
        return nested;
      }
    }

    return null;
  }

  if (value && typeof value === "object") {
    for (const nestedValue of Object.values(value)) {
      const nested = extractFirstErrorMessage(nestedValue);
      if (nested) {
        return nested;
      }
    }
  }

  return null;
}

export async function authRequest<T>(path: string, options?: RequestOptions) {
  const response = await fetch(`${BACKEND_URL}${path}`, {
    method: options?.method ?? "POST",
    credentials: "include",
    headers:
      options?.body !== undefined
        ? { "Content-Type": "application/json" }
        : undefined,
    body:
      options?.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    let errorMessage = "Une erreur est survenue.";

    try {
      const payload = (await response.json()) as Record<string, unknown>;
      const extractedMessage = extractFirstErrorMessage(
        payload.message ?? payload,
      );

      if (extractedMessage) {
        errorMessage = extractedMessage;
      }
    } catch {
      // noop
    }

    throw new Error(errorMessage);
  }

  return (await response.json()) as T;
}
