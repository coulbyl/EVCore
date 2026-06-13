export const BACKEND_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

type ErrorPayload = {
  message?: unknown;
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

// Carries the HTTP status so callers can branch on it (quota, ownership…)
// instead of matching on backend message wording.
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function parseApiError(
  response: Response,
  fallbackMessage: string,
): Promise<ApiError> {
  try {
    const payload = (await response.json()) as ErrorPayload | unknown;
    const extractedMessage = extractFirstErrorMessage(
      (payload as ErrorPayload).message ?? payload,
    );

    if (extractedMessage) {
      return new ApiError(extractedMessage, response.status);
    }
  } catch {
    try {
      const text = await response.text();

      if (text.trim() !== "") {
        return new ApiError(text, response.status);
      }
    } catch {
      // noop
    }
  }

  return new ApiError(fallbackMessage, response.status);
}
