// Pure reducer: applies one SSE event from the EVA stream to the streaming
// assistant message. No JSX, no hooks — kept out of the page client.

import type { ChatMessage, ChatStreamEvent } from "@/domains/chat/types/chat";

export function applyStreamEvent(
  message: ChatMessage,
  event: ChatStreamEvent,
): ChatMessage {
  switch (event.event) {
    case "token":
      return { ...message, text: message.text + event.data.text };
    case "tool_start":
      return { ...message, toolLabel: event.data.label };
    case "tool_end":
      return { ...message, toolLabel: undefined };
    case "picks": {
      // Several tools can push picks for one answer — merge without dupes.
      const existing = message.picks ?? [];
      const seen = new Set(
        existing.map((p) => `${p.match}|${p.market}|${p.pick}`),
      );
      const added = event.data.picks.filter(
        (p) => !seen.has(`${p.match}|${p.market}|${p.pick}`),
      );
      return { ...message, picks: [...existing, ...added] };
    }
    case "done":
      return {
        ...message,
        id: event.data.messageId,
        streaming: false,
        toolLabel: undefined,
      };
    case "error":
      return {
        ...message,
        text: event.data.message,
        streaming: false,
        toolLabel: undefined,
        error: true,
      };
  }
}
