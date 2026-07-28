"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import type {
  CreateSubscriptionInput,
  Subscription,
} from "../types/subscriptions";
import { clientApiRequest } from "@/lib/api/client-api";

export async function createSubscription(
  input: CreateSubscriptionInput,
): Promise<Subscription> {
  // channelPickMode/topN omis (pas envoyés à null) pour les sources Coupon —
  // le DTO backend les valide comme "non applicables" s'ils sont présents.
  const body: Record<string, unknown> = {
    sourceType: input.sourceType,
    stakePerEvent: input.stakePerEvent,
    daysOfWeek: input.daysOfWeek,
    competitionCodes: input.competitionCodes,
    startDate: input.startDate,
    endDate: input.endDate,
  };
  if (input.channelPickMode !== null)
    body.channelPickMode = input.channelPickMode;
  if (input.topN !== null) body.topN = input.topN;

  return clientApiRequest<Subscription>("/subscriptions", {
    method: "POST",
    body,
    fallbackErrorMessage: "Impossible de créer l'abonnement.",
  });
}

export function useCreateSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSubscription,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
    },
  });
}
