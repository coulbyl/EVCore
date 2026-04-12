export const TIME_SLOTS = [
  { key: "morning", label: "Matin", start: 0, end: 11 },
  { key: "noon", label: "Midi", start: 12, end: 13 },
  { key: "afternoon", label: "Après-midi", start: 14, end: 17 },
  { key: "evening", label: "Soirée", start: 18, end: 21 },
  { key: "night", label: "Nuit", start: 22, end: 23 },
] as const;

export type TimeSlotKey = (typeof TIME_SLOTS)[number]["key"];
