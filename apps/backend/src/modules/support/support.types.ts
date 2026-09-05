import type { SupportConversationStatus } from '@evcore/db';

export type SupportMessageDto = {
  id: string;
  conversationId: string;
  senderId: string;
  senderRole: 'ADMIN' | 'OPERATOR';
  senderUsername: string;
  content: string;
  createdAt: Date;
};

export type SupportConversationDto = {
  id: string;
  userId: string;
  status: SupportConversationStatus;
  userReadAt: Date | null;
  adminReadAt: Date | null;
  lastMessageAt: Date;
  createdAt: Date;
};

// Admin inbox row — one per conversation, enough to render a list without
// fetching every message.
export type SupportConversationSummaryDto = SupportConversationDto & {
  username: string;
  fullName: string;
  avatarUrl: string | null;
  lastMessage: SupportMessageDto | null;
  unreadCount: number;
};

// Client → server: "I started/stopped typing". conversationId is required
// for admins (who have many open threads) and ignored for operators (their
// own conversation, resolved server-side from the socket session).
export type TypingClientPayload = {
  conversationId?: string;
  isTyping: boolean;
};

// Server → clients: relayed to the other side of the conversation, plus the
// admin room so any operator list view can show a live indicator.
export type TypingBroadcastDto = {
  conversationId: string;
  userId: string;
  username: string;
  role: 'ADMIN' | 'OPERATOR';
  isTyping: boolean;
};
