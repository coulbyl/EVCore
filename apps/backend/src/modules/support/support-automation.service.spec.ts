import { describe, expect, it, vi } from 'vitest';
import { SupportAutomationService } from './support-automation.service';
import { WELCOME_MESSAGE_CONTENT } from '@/config/support.constants';
import type { SupportRepository } from './support.repository';

const CONVERSATION_ID = 'conversation-1';

function makeRepo(
  overrides: Partial<SupportRepository> = {},
): SupportRepository {
  return {
    createAutomatedMessageIfAbsent: vi.fn().mockResolvedValue({
      id: 'message-welcome-1',
      conversationId: CONVERSATION_ID,
      content: WELCOME_MESSAGE_CONTENT,
      createdAt: new Date('2026-09-05T10:00:00Z'),
    }),
    ...overrides,
  } as unknown as SupportRepository;
}

describe('SupportAutomationService — triggerFirstContact', () => {
  it('does nothing for a conversation that already existed', async () => {
    const repo = makeRepo();
    const service = new SupportAutomationService(repo);

    const result = await service.triggerFirstContact({
      conversationId: CONVERSATION_ID,
      isNewConversation: false,
    });

    expect(result).toBeNull();
    expect(repo.createAutomatedMessageIfAbsent).not.toHaveBeenCalled();
  });

  it('creates and returns the welcome message for a new conversation', async () => {
    const repo = makeRepo();
    const service = new SupportAutomationService(repo);

    const result = await service.triggerFirstContact({
      conversationId: CONVERSATION_ID,
      isNewConversation: true,
    });

    expect(repo.createAutomatedMessageIfAbsent).toHaveBeenCalledWith({
      conversationId: CONVERSATION_ID,
      automationKey: 'WELCOME',
      content: WELCOME_MESSAGE_CONTENT,
    });
    expect(result).toMatchObject({
      id: 'message-welcome-1',
      conversationId: CONVERSATION_ID,
      senderId: null,
      senderRole: 'ADMIN',
      senderUsername: 'EVCore',
      content: WELCOME_MESSAGE_CONTENT,
      attachment: null,
      kind: 'AUTOMATED',
    });
  });

  it('returns null without throwing when the repository lost the idempotence race', async () => {
    // createAutomatedMessageIfAbsent itself swallows the unique-constraint
    // conflict and resolves null — this is the "someone else already sent
    // it" case (concurrent trigger from the REST path and the socket path).
    const repo = makeRepo({
      createAutomatedMessageIfAbsent: vi.fn().mockResolvedValue(null),
    });
    const service = new SupportAutomationService(repo);

    const result = await service.triggerFirstContact({
      conversationId: CONVERSATION_ID,
      isNewConversation: true,
    });

    expect(result).toBeNull();
  });
});
