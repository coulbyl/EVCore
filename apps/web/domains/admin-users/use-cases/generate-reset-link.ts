"use client";

import { clientApiRequest } from "@/lib/api/client-api";

export async function generateAdminResetLink(userId: string): Promise<string> {
  const payload = await clientApiRequest<{ resetUrl: string }>(
    `/admin/users/${userId}/reset-password-link`,
    {
      method: "POST",
      fallbackErrorMessage: "Impossible de générer le lien.",
    },
  );
  return payload.resetUrl;
}
