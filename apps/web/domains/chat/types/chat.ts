// NOTE: the backend pick engine exposes canals as EV | SV | BB | NUL | CONF —
// align these values when structured picks get wired to the stream.
export type Canal = "EV" | "SV" | "CONF" | "DRAW" | "BTTS";

export type ChatPick = {
  canal: Canal;
  match: string;
  pick: string;
  odds: number;
  ev: number;
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
  createdAt: string;
};

export type ChatStreamEvent =
  | { event: "tool_start"; data: { tool: string; label: string } }
  | { event: "tool_end"; data: { tool: string; ms: number } }
  | { event: "token"; data: { text: string } }
  | {
      event: "done";
      data: { messageId: string; inputTokens: number; outputTokens: number };
    }
  | { event: "error"; data: { code: string; message: string } };
