export type SupportConversationStatus = "OPEN" | "CLOSED";

export type SupportMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "ADMIN" | "OPERATOR";
  senderUsername: string;
  content: string;
  createdAt: string;
  // Set by the backend once automated messages ship (welcome, reminders…) —
  // absent today, so every check below treats undefined as "STANDARD".
  kind?: "STANDARD" | "AUTOMATED";
  // Frontend-only: optimistic messages carry this while in flight, dropped
  // once the server confirms them. Never present on a message read from the
  // API.
  status?: "sending" | "failed";
};

export type TypingEvent = {
  conversationId: string;
  userId: string;
  username: string;
  role: "ADMIN" | "OPERATOR";
  isTyping: boolean;
};

export type SupportConversation = {
  id: string;
  userId: string;
  status: SupportConversationStatus;
  userReadAt: string | null;
  adminReadAt: string | null;
  lastMessageAt: string;
  createdAt: string;
};

export type SupportConversationSummary = SupportConversation & {
  username: string;
  fullName: string;
  avatarUrl: string | null;
  lastMessage: SupportMessage | null;
  unreadCount: number;
};

export type OwnConversationResponse = {
  conversation: SupportConversation;
  messages: SupportMessage[];
};
