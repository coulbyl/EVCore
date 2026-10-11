"use client";

import { CompetitionRanking } from "@/app/dashboard/components/competition-ranking";
import { useCompetitionStats } from "@/domains/dashboard/use-cases/get-competition-stats";

/**
 * Classement des ligues par calibration du moteur (30 jours glissants, la
 * fenêtre fixe de l'endpoint). Déplacé de l'accueil vers Mesures
 * historiques le 2026-10-11 : c'est une mesure, pas une action du jour.
 */
export function CompetitionRankingSection() {
  const { data, isLoading, isError } = useCompetitionStats();
  return (
    <CompetitionRanking
      stats={data ?? []}
      isLoading={isLoading}
      isError={isError}
    />
  );
}
