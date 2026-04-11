import type {
  FixtureDecisionFilter,
  FixtureStatusFilter,
} from "../types/fixture";

export const DECISION_OPTIONS: {
  value: FixtureDecisionFilter;
  label: string;
}[] = [
  { value: "ALL", label: "Tous" },
  { value: "BET", label: "BET" },
  { value: "NO_BET", label: "NO BET" },
];

export const STATUS_OPTIONS: { value: FixtureStatusFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "SCHEDULED", label: "Planifié" },
  { value: "LIVE", label: "En cours" },
  { value: "FINISHED", label: "Terminé" },
];
