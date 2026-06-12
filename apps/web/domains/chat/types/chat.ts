// Canonical canal values from the backend pick engine.
export type Canal = "EV" | "SV" | "BB" | "NUL" | "CONF";

// Mirrors the backend ChatStreamPick payload ('picks' SSE event + persisted
// picks on assistant messages).
export type ChatPick = {
  canal: Canal;
  match: string;
  market: string;
  pick: string;
  odds: number | null;
  proba: number;
  reliability: number | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "eva";
  text: string;
  error?: boolean;
  toolLabel?: string;
  picks?: ChatPick[];
  streaming?: boolean;
};

export type ChatConversation = {
  id: string;
  title: string;
  group: string;
  messages: ChatMessage[];
};

export type ChatConversationDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageDto = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  toolName: string | null;
  picks: ChatPick[] | null;
  createdAt: string;
};

export type ChatStreamEvent =
  | { event: "tool_start"; data: { tool: string; label: string } }
  | { event: "tool_end"; data: { tool: string; ms: number } }
  | { event: "token"; data: { text: string } }
  | { event: "picks"; data: { tool: string; picks: ChatPick[] } }
  | {
      event: "done";
      data: { messageId: string; inputTokens: number; outputTokens: number };
    }
  | { event: "error"; data: { code: string; message: string } };
