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
