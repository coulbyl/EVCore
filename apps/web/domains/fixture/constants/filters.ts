import type {
  FixtureBetStatusFilter,
  FixtureCanalFilter,
  FixtureDecisionFilter,
  FixtureStatusFilter,
} from "../types/fixture";

export const DECISION_OPTIONS: {
  value: FixtureDecisionFilter;
  label: string;
}[] = [
  { value: "ALL", label: "Tous" },
  { value: "BET", label: "Jouer" },
  { value: "NO_BET", label: "Passer" },
];

export const CANAL_OPTIONS: { value: FixtureCanalFilter; label: string }[] = [
  { value: "ALL", label: "Tous canaux" },
  { value: "EV", label: "Canal EV" },
  { value: "SV", label: "Safe Value" },
  { value: "CONF", label: "Confiance" },
  { value: "DRAW", label: "NUL" },
  { value: "BTTS", label: "BB" },
];

export const STATUS_OPTIONS: { value: FixtureStatusFilter; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "SCHEDULED", label: "Planifié" },
  { value: "LIVE", label: "En cours" },
  { value: "FINISHED", label: "Terminé" },
];

export const BET_STATUS_OPTIONS: {
  value: FixtureBetStatusFilter;
  label: string;
}[] = [
  { value: "ALL", label: "Tous" },
  { value: "WON", label: "Gagné" },
  { value: "LOST", label: "Perdu" },
  { value: "PENDING", label: "En attente" },
];
