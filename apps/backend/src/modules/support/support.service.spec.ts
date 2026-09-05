import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { UserRole } from '@evcore/db';
import { SupportService } from './support.service';
import type { SupportRepository } from './support.repository';
import type { SupportGateway } from './support.gateway';
import type { SupportNotifierService } from './support-notifier.service';
import type { StorageService } from '@modules/storage/storage.service';

const CONVERSATION_ID = 'conversation-1';
const USER_ID = 'user-1';

function makeRawMessage(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'message-1',
    conversationId: CONVERSATION_ID,
    senderId: USER_ID,
    content: 'Salut',
    createdAt: new Date('2026-09-05T10:00:00Z'),
    sender: { username: 'op1', role: UserRole.OPERATOR },
    attachment: null,
    ...overrides,
  };
}

function makeRepo(
  overrides: Partial<SupportRepository> = {},
): SupportRepository {
  return {
    getOrCreateConversationForUser: vi
      .fn()
      .mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID }),
    findConversationById: vi
      .fn()
      .mockResolvedValue({ id: CONVERSATION_ID, userId: USER_ID }),
    findUserEmail: vi.fn().mockResolvedValue(null),
    userExists: vi.fn().mockResolvedValue(true),
    createConversation: vi.fn(),
    findConversationByUserId: vi.fn(),
    listRecentMessages: vi
      .fn()
      .mockResolvedValue({ messages: [makeRawMessage()], hasMore: false }),
    listMessagesBefore: vi
      .fn()
      .mockResolvedValue({ messages: [], hasMore: false }),
    createMessage: vi.fn().mockResolvedValue(makeRawMessage()),
    markReadByUser: vi.fn(),
    markReadByAdmin: vi.fn(),
    setStatus: vi.fn(),
    countUnreadForUser: vi.fn().mockResolvedValue(0),
    countUnreadForAdmin: vi.fn().mockResolvedValue(0),
    listConversationsForAdmin: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as SupportRepository;
}

function makeNotifier(): SupportNotifierService {
  return {
    notifyAdmin: vi.fn().mockResolvedValue(undefined),
    notifyUser: vi.fn().mockResolvedValue(undefined),
  } as unknown as SupportNotifierService;
}

function makeGateway(): SupportGateway {
  return { emitMessage: vi.fn() } as unknown as SupportGateway;
}

function makeStorage(overrides: Partial<StorageService> = {}): StorageService {
  return {
    isEnabled: vi.fn().mockReturnValue(true),
    createUploadUrl: vi.fn().mockResolvedValue('https://rustfs.local/upload'),
    createDownloadUrl: vi
      .fn()
      .mockResolvedValue('https://rustfs.local/download'),
    headObject: vi.fn().mockResolvedValue({
      exists: true,
      contentLength: 42,
      contentType: 'image/png',
    }),
    deleteObject: vi.fn(),
    ...overrides,
  } as unknown as StorageService;
}

describe('SupportService — sendAsUser', () => {
  it('sends a text-only message', async () => {
    const repo = makeRepo();
    const service = new SupportService(
      repo,
      makeNotifier(),
      makeGateway(),
      makeStorage(),
    );

    const dto = await service.sendAsUser(USER_ID, { content: 'Bonjour' });

    expect(repo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: CONVERSATION_ID,
        senderId: USER_ID,
        content: 'Bonjour',
        attachment: undefined,
      }),
    );
    expect(dto.content).toBe('Salut'); // from the mocked createMessage return
  });

  it('rejects a message with neither content nor an attachment', async () => {
    const service = new SupportService(
      makeRepo(),
      makeNotifier(),
      makeGateway(),
      makeStorage(),
    );

    await expect(service.sendAsUser(USER_ID, {})).rejects.toThrow(
      BadRequestException,
    );
  });

  it('treats whitespace-only content as absent', async () => {
    const service = new SupportService(
      makeRepo(),
      makeNotifier(),
      makeGateway(),
      makeStorage(),
    );

    await expect(
      service.sendAsUser(USER_ID, { content: '   ' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts an attachment-only message and resolves it via HeadObject', async () => {
    const repo = makeRepo();
    const storage = makeStorage();
    const service = new SupportService(
      repo,
      makeNotifier(),
      makeGateway(),
      storage,
    );

    await service.sendAsUser(USER_ID, {
      attachment: {
        objectKey: `support/${CONVERSATION_ID}/abc.png`,
        kind: 'IMAGE',
      },
    });

    expect(storage.headObject).toHaveBeenCalledWith(
      `support/${CONVERSATION_ID}/abc.png`,
    );
    expect(repo.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        content: null,
        attachment: expect.objectContaining({
          kind: 'IMAGE',
          objectKey: `support/${CONVERSATION_ID}/abc.png`,
          // Authoritative values come from HeadObject, not the client.
          mimeType: 'image/png',
          sizeBytes: 42,
        }),
      }),
    );
  });

  it('rejects an attachment whose objectKey belongs to a different conversation', async () => {
    const service = new SupportService(
      makeRepo(),
      makeNotifier(),
      makeGateway(),
      makeStorage(),
    );

    await expect(
      service.sendAsUser(USER_ID, {
        attachment: {
          objectKey: 'support/some-other-conversation/abc.png',
          kind: 'IMAGE',
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects an attachment that was never actually uploaded', async () => {
    const storage = makeStorage({
      headObject: vi.fn().mockResolvedValue({
        exists: false,
        contentLength: null,
        contentType: null,
      }),
    });
    const service = new SupportService(
      makeRepo(),
      makeNotifier(),
      makeGateway(),
      storage,
    );

    await expect(
      service.sendAsUser(USER_ID, {
        attachment: {
          objectKey: `support/${CONVERSATION_ID}/missing.png`,
          kind: 'IMAGE',
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('SupportService — createAttachmentUploadUrl', () => {
  it('rejects when storage is not configured', async () => {
    const service = new SupportService(
      makeRepo(),
      makeNotifier(),
      makeGateway(),
      makeStorage({ isEnabled: vi.fn().mockReturnValue(false) }),
    );

    await expect(
      service.createAttachmentUploadUrl({
        conversationId: CONVERSATION_ID,
        kind: 'IMAGE',
        mimeType: 'image/png',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a disallowed mime type for the given kind', async () => {
    const service = new SupportService(
      makeRepo(),
      makeNotifier(),
      makeGateway(),
      makeStorage(),
    );

    await expect(
      service.createAttachmentUploadUrl({
        conversationId: CONVERSATION_ID,
        kind: 'IMAGE',
        mimeType: 'application/x-msdownload',
        sizeBytes: 1024,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('namespaces the generated objectKey under the conversation', async () => {
    const storage = makeStorage();
    const service = new SupportService(
      makeRepo(),
      makeNotifier(),
      makeGateway(),
      storage,
    );

    const result = await service.createAttachmentUploadUrl({
      conversationId: CONVERSATION_ID,
      kind: 'IMAGE',
      mimeType: 'image/png',
      sizeBytes: 1024,
    });

    expect(result.objectKey.startsWith(`support/${CONVERSATION_ID}/`)).toBe(
      true,
    );
    expect(result.objectKey.endsWith('.png')).toBe(true);
    expect(storage.createUploadUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        objectKey: result.objectKey,
        contentType: 'image/png',
        contentLength: 1024,
      }),
    );
  });
});

describe('SupportService — pagination', () => {
  it('caps the requested limit at the configured maximum', async () => {
    const repo = makeRepo();
    const service = new SupportService(
      repo,
      makeNotifier(),
      makeGateway(),
      makeStorage(),
    );

    await service.loadOlderMessages(CONVERSATION_ID, 'message-50', 10_000);

    expect(repo.listMessagesBefore).toHaveBeenCalledWith(
      CONVERSATION_ID,
      'message-50',
      100, // SUPPORT_MESSAGES_PAGINATION.maxLimit
    );
  });

  it('reports hasMore from the repository page as-is', async () => {
    const repo = makeRepo({
      listRecentMessages: vi
        .fn()
        .mockResolvedValue({ messages: [makeRawMessage()], hasMore: true }),
    });
    const service = new SupportService(
      repo,
      makeNotifier(),
      makeGateway(),
      makeStorage(),
    );

    const { hasMore } = await service.getOwnConversation(USER_ID);

    expect(hasMore).toBe(true);
  });
});
