/**
 * Durées de pause proposées au joueur (jeu responsable, décision du
 * 2026-10-28). Pas de retour anticipé : une pause ne peut qu'être prolongée.
 */
export const PAUSE_DURATIONS_DAYS = [1, 7, 30] as const;

export type PauseDurationDays = (typeof PAUSE_DURATIONS_DAYS)[number];
