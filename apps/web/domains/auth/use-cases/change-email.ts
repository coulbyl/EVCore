"use client";

import { authRequest } from "./auth-request";

/** Étape 1 : mot de passe, puis un code part vers la nouvelle adresse. */
export async function requestEmailChange(input: {
  newEmail: string;
  password: string;
}): Promise<void> {
  await authRequest<{ status: "ok" }>("/auth/me/email/request", {
    body: input,
    fallbackErrorMessage: "Impossible d'envoyer le code.",
  });
}

/** Étape 2 : le code reçu ; renvoie l'adresse désormais active. */
export async function confirmEmailChange(
  code: string,
): Promise<{ email: string }> {
  return authRequest<{ email: string }>("/auth/me/email/confirm", {
    body: { code },
    fallbackErrorMessage: "Impossible de confirmer le code.",
  });
}
