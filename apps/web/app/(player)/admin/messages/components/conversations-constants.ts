import type {
  SupportConversationSummary,
  SupportMessage,
} from "@/domains/support/types/support";

/**
 * Where a conversation stands for the team (12-admin.md § 3):
 * - `to_answer`: the player wrote last, nobody answered yet;
 * - `exchange`: a human exchange exists, the team spoke last;
 * - `silent`: the player never wrote, only the team's messages (the
 *   welcome, old hand-written greetings).
 */
export type ConversationState = "to_answer" | "exchange" | "silent";

function human(message: SupportMessage | null): boolean {
  return message !== null && message.kind !== "AUTOMATED";
}

export function conversationStateOf(
  conversation: SupportConversationSummary,
): ConversationState {
  const last = conversation.lastMessage;
  if (!conversation.playerWrote || !human(last)) return "silent";
  return last?.senderRole === "OPERATOR" ? "to_answer" : "exchange";
}

/**
 * The list in the order one acts: to answer, the oldest wait first; then
 * the other exchanges, latest first. Silent accounts are counted apart.
 */
export function sortConversations(
  conversations: readonly SupportConversationSummary[],
  query: string,
): {
  toAnswer: SupportConversationSummary[];
  others: SupportConversationSummary[];
  silent: SupportConversationSummary[];
} {
  const q = query.trim().toLowerCase();
  const matching = q
    ? conversations.filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          (c.username ?? "").toLowerCase().includes(q),
      )
    : conversations;
  const at = (c: SupportConversationSummary) => Date.parse(c.lastMessageAt);
  const of = (state: ConversationState) =>
    matching.filter((c) => conversationStateOf(c) === state);
  return {
    toAnswer: of("to_answer").sort((a, b) => at(a) - at(b)),
    others: of("exchange").sort((a, b) => at(b) - at(a)),
    silent: of("silent").sort((a, b) => at(b) - at(a)),
  };
}
