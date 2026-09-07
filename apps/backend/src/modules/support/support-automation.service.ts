import { Injectable } from '@nestjs/common';
import {
  SUPPORT_AUTOMATION_KEYS,
  WELCOME_MESSAGE_CONTENT,
} from '@/config/support.constants';
import { SupportRepository } from './support.repository';
import type { SupportMessageDto } from './support.types';

// First-contact automations for the support chat — currently just the
// welcome message, structured so a future one (inactivity nudge, feature
// announcement, feedback request…) is "add a key + a trigger call", not a
// new subsystem: same createAutomatedMessageIfAbsent idempotence guarantee,
// same DTO shape, just a different automationKey and content.
//
// Deliberately has no SupportGateway dependency — both of this service's
// callers (SupportGateway.handleConnection, SupportService.getOwnConversation)
// already have gateway access themselves, and injecting it here would create
// a constructor cycle with whichever of them owns the gateway. Callers emit
// the DTO this returns.
@Injectable()
export class SupportAutomationService {
  constructor(private readonly repo: SupportRepository) {}

  // Call wherever "was this conversation just created" is already known.
  // Returns the message to broadcast, or null when there's nothing to do —
  // either this isn't a new conversation, or a concurrent trigger (a socket
  // connect and a REST fetch landing at the same instant, a reconnect, a
  // retry) already won the race. The DB unique constraint
  // (conversationId, automationKey) is what makes "call this from more than
  // one place" safe rather than a double-send risk.
  async triggerFirstContact(input: {
    conversationId: string;
    isNewConversation: boolean;
  }): Promise<SupportMessageDto | null> {
    if (!input.isNewConversation) return null;

    const raw = await this.repo.createAutomatedMessageIfAbsent({
      conversationId: input.conversationId,
      automationKey: SUPPORT_AUTOMATION_KEYS.WELCOME,
      content: WELCOME_MESSAGE_CONTENT,
    });
    if (!raw) return null;

    return {
      id: raw.id,
      conversationId: raw.conversationId,
      senderId: null,
      senderRole: 'ADMIN',
      senderUsername: 'EVCore',
      content: raw.content,
      attachment: null,
      kind: 'AUTOMATED',
      createdAt: raw.createdAt,
    };
  }
}
