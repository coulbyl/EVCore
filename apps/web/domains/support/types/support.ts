export type SupportConversationStatus = "OPEN" | "CLOSED";

export type SupportMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: "ADMIN" | "OPERATOR";
  senderUsername: string;
  content: string;
  createdAt: string;
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
