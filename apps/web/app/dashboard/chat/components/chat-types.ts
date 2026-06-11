import type { Canal } from "./chat-constants";

export type ChatPick = {
  canal: Canal;
  match: string;
  pick: string;
  odds: number;
  ev: number;
  proba: number;
  // 30-day hit rate of the canal×league, when available.
  reliability: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "eva";
  text: string;
  // Tool activity shown while EVA is querying the engine (e.g. "Recherche des picks…").
  toolLabel?: string;
  // Structured picks rendered as cards below the text.
  picks?: ChatPick[];
  // True while the assistant text is still streaming (shows the caret).
  streaming?: boolean;
};

export type ChatConversation = {
  id: string;
  title: string;
  // Grouping label for the sidebar ("Aujourd'hui", "Hier", …).
  group: string;
  messages: ChatMessage[];
};
