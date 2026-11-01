// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  conversationStateOf,
  sortConversations,
} from "./conversations-constants.ts";

const message = (senderRole, kind = "STANDARD") => ({
  id: "m",
  conversationId: "c",
  senderId: kind === "AUTOMATED" ? null : "u",
  senderRole,
  senderUsername: "",
  content: "x",
  createdAt: "2026-11-01T10:00:00Z",
  kind,
});
const conversation = (id, fullName, lastMessage, lastMessageAt) => ({
  id,
  userId: id,
  status: "OPEN",
  userReadAt: null,
  adminReadAt: null,
  lastMessageAt,
  createdAt: lastMessageAt,
  username: null,
  fullName,
  avatarUrl: null,
  lastMessage,
  unreadCount: 0,
  playerWrote: true,
});

describe("admin messages", () => {
  it("a player's last word is to answer; the welcome alone is silent", () => {
    assert.equal(
      conversationStateOf(conversation("a", "A", message("OPERATOR"), "")),
      "to_answer",
    );
    assert.equal(
      conversationStateOf(conversation("a", "A", message("ADMIN"), "")),
      "exchange",
    );
    assert.equal(
      conversationStateOf(
        conversation("a", "A", message("ADMIN", "AUTOMATED"), ""),
      ),
      "silent",
    );
    assert.equal(
      conversationStateOf(conversation("a", "A", null, "")),
      "silent",
    );
    // The team's hand-written greeting, the player never answered.
    assert.equal(
      conversationStateOf({
        ...conversation("a", "A", message("ADMIN"), ""),
        playerWrote: false,
      }),
      "silent",
    );
  });

  it("the oldest wait comes first, then the latest exchanges", () => {
    const list = [
      conversation("new", "Aya", message("OPERATOR"), "2026-11-01T10:00:00Z"),
      conversation("old", "Ben", message("OPERATOR"), "2026-10-30T10:00:00Z"),
      conversation("x1", "Cy", message("ADMIN"), "2026-10-29T10:00:00Z"),
      conversation("x2", "Dia", message("ADMIN"), "2026-10-31T10:00:00Z"),
    ];
    const sorted = sortConversations(list, "");
    assert.deepEqual(
      sorted.toAnswer.map((c) => c.id),
      ["old", "new"],
    );
    assert.deepEqual(
      sorted.others.map((c) => c.id),
      ["x2", "x1"],
    );
    assert.deepEqual(
      sortConversations(list, " ay ").toAnswer.map((c) => c.id),
      ["new"],
    );
  });
});
