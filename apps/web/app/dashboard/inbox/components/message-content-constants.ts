import type { SupportMessage } from "@/domains/support/types/support";

// Captures the URL itself as group 1 — .split() on a pattern with a
// capturing group keeps the matches in the output, alternating with the
// surrounding plain text, so no manual index bookkeeping is needed.
const URL_SPLIT_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;!?'")\]])/g;
const URL_TEST_PATTERN = /^https?:\/\//i;

export type MessageTextPart = { text: string; isUrl: boolean };

export function splitMessageText(content: string): MessageTextPart[] {
  return content
    .split(URL_SPLIT_PATTERN)
    .filter((part) => part.length > 0)
    .map((text) => ({ text, isUrl: URL_TEST_PATTERN.test(text) }));
}

// Variation selector-16 (forces emoji presentation) and zero-width joiner
// (glues emoji sequences like 👨‍👩‍👧 together) — both invisible, both need
// stripping before counting "how many emoji is this really".
const VARIATION_SELECTOR_OR_ZWJ = /[\s\uFE0F\u200D]/gu;
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

// A message that's just a handful of emoji (👍, 🎉🙏, …) reads better large
// — mirrors what most modern chat apps do. Capped at 8 so a paragraph that
// merely starts with an emoji doesn't get blown up.
export function isEmojiOnlyMessage(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 32) return false;
  const stripped = trimmed.replace(VARIATION_SELECTOR_OR_ZWJ, "");
  if (!stripped) return false;
  const codePoints = [...stripped];
  if (codePoints.length > 8) return false;
  return codePoints.every((char) => EXTENDED_PICTOGRAPHIC.test(char));
}

// The "Nouveaux messages" divider position — the first message from the
// other side that arrived after my own last-read watermark. Callers freeze
// the result (useMemo keyed only on conversationId) so it doesn't jump
// around as the watermark advances while the thread stays open.
export function findFirstUnreadMessageId(input: {
  messages: SupportMessage[] | undefined;
  myReadAt: string | null | undefined;
  currentRole: "ADMIN" | "OPERATOR";
}): string | null {
  const { messages, myReadAt, currentRole } = input;
  if (!messages || !myReadAt) return null;
  const readWatermark = new Date(myReadAt).getTime();
  const firstUnread = messages.find(
    (message) =>
      message.senderRole !== currentRole &&
      new Date(message.createdAt).getTime() > readWatermark,
  );
  return firstUnread?.id ?? null;
}
