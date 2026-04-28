"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientApiRequest } from "@/lib/api/client-api";

export type UpdateCompetitionActiveInput = {
  code: string;
  isActive: boolean;
};

export type UpdateCompetitionActiveResponse = {
  code: string;
  name: string;
  isActive: boolean;
};

async function updateCompetitionActive(
  input: UpdateCompetitionActiveInput,
): Promise<UpdateCompetitionActiveResponse> {
  return clientApiRequest<UpdateCompetitionActiveResponse>(
    `/audit/competition/${input.code}/active`,
    {
      method: "PATCH",
      body: { isActive: input.isActive },
      fallbackErrorMessage:
        "Impossible de mettre à jour l'état de la compétition.",
    },
  );
}

export function useUpdateCompetitionActive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCompetitionActive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["audit-overview"] });
    },
  });
}
