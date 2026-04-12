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

export async function parseApiError(
  response: Response,
  fallbackMessage: string,
): Promise<Error> {
  try {
    const payload = (await response.json()) as ErrorPayload | unknown;
    const extractedMessage = extractFirstErrorMessage(
      (payload as ErrorPayload).message ?? payload,
    );

    if (extractedMessage) {
      return new Error(extractedMessage);
    }
  } catch {
    try {
      const text = await response.text();

      if (text.trim() !== "") {
        return new Error(text);
      }
    } catch {
      // noop
    }
  }

  return new Error(fallbackMessage);
}
