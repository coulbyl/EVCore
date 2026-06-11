// Mock data for the EVA static shell. Replaced by real Groq + DB wiring in
// the phase 4 backend implementation. Numbers here are illustrative only.

import type { ChatConversation, ChatMessage } from "./chat-types";

export const MOCK_CONVERSATIONS: ChatConversation[] = [
  {
    id: "c1",
    title: "Picks EV de ce soir",
    group: "Aujourd'hui",
    messages: [
      { id: "m1", role: "user", text: "Quels picks EV ce soir ?" },
      {
        id: "m2",
        role: "eva",
        text: "Voici les 2 picks EV générés par le moteur ce soir. Rappel : une proba de 48% perd plus d'une fois sur deux — ce sont des paris de valeur, pas des certitudes.",
        toolLabel: "Recherche des picks du jour",
        picks: [
          {
            canal: "EV",
            match: "Leverkusen vs Mainz",
            pick: "BTTS Oui",
            odds: 2.75,
            ev: 0.33,
            proba: 0.48,
            reliability: 0.62,
          },
          {
            canal: "SV",
            match: "Brésil vs Maroc",
            pick: "+1.5 buts",
            odds: 1.35,
            ev: 0.15,
            proba: 0.86,
            reliability: 0.71,
          },
        ],
      },
    ],
  },
  {
    id: "c2",
    title: "ROI du canal DRAW sur 30j",
    group: "Aujourd'hui",
    messages: [],
  },
  {
    id: "c3",
    title: "Coupon du jour",
    group: "Hier",
    messages: [],
  },
  {
    id: "c4",
    title: "Ligues fiables pour le BTTS",
    group: "7 derniers jours",
    messages: [],
  },
];

// Canned EVA replies for the static shell — rotated so successive sends don't
// look identical. Replaced by real Groq + tool calls in the phase 4 backend.
const MOCK_REPLIES: Omit<ChatMessage, "id" | "role">[] = [
  {
    text: "Voici un pick CONF du moteur. (Aperçu statique — le backend Groq n'est pas encore branché.)",
    toolLabel: "Recherche des picks du jour",
    picks: [
      {
        canal: "CONF",
        match: "Allemagne vs Curaçao",
        pick: "Allemagne",
        odds: 1.18,
        ev: 0.06,
        proba: 0.95,
        reliability: 0.68,
      },
    ],
  },
  {
    text: "Le canal DRAW est fiable en ce moment sur ces ligues. (Aperçu statique.)",
    toolLabel: "Calcul des performances par ligue",
    picks: [
      {
        canal: "DRAW",
        match: "Corée du Sud vs Tchéquie",
        pick: "Match nul",
        odds: 3.2,
        ev: 0.11,
        proba: 0.32,
        reliability: 0.36,
      },
    ],
  },
  {
    text: "Voici le meilleur pick BTTS du jour. (Aperçu statique.)",
    toolLabel: "Recherche des coupons du jour",
    picks: [
      {
        canal: "BTTS",
        match: "Pays-Bas vs Japon",
        pick: "Les deux marquent",
        odds: 1.8,
        ev: 0.09,
        proba: 0.53,
        reliability: 0.58,
      },
    ],
  },
];

let replyCursor = 0;

export function mockEvaReply(id: string): ChatMessage {
  const base = MOCK_REPLIES[replyCursor % MOCK_REPLIES.length]!;
  replyCursor += 1;
  return { id, role: "eva", ...base };
}
