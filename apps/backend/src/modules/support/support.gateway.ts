import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { UserRole } from '@evcore/db';
import { AuthService } from '@modules/auth/auth.service';
import type { AuthenticatedRequest } from '@modules/auth/auth.types';
import { createLogger } from '@utils/logger';
import { SupportRepository } from './support.repository';
import type {
  SupportMessageDto,
  TypingBroadcastDto,
  TypingClientPayload,
} from './support.types';

const logger = createLogger('support-gateway');

const ADMIN_ROOM = 'admin:support';
const conversationRoom = (conversationId: string) =>
  `conversation:${conversationId}`;

function resolveCorsOrigins(): string[] {
  return process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : [];
}

// Real-time layer for the human support chat (feedback + personal questions,
// see docs/business-model.md §6/§8). Every operator has exactly one
// conversation and joins its room on connect; every admin joins a single
// shared room and receives all conversations' messages there — filtered
// client-side — since the current scale (~24 users) doesn't warrant
// per-thread subscription management.
@WebSocketGateway({
  namespace: '/support',
  cors: {
    origin: (origin, callback) => {
      const allowed = resolveCorsOrigins();
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  },
})
export class SupportGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly repo: SupportRepository,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const session = await this.authenticate(client);
    if (!session) {
      client.disconnect(true);
      return;
    }

    client.data.userId = session.user.id;
    client.data.role = session.user.role;
    client.data.username = session.user.fullName || session.user.username;

    if (session.user.role === UserRole.ADMIN) {
      await client.join(ADMIN_ROOM);
      return;
    }

    const conversation = await this.repo.getOrCreateConversationForUser(
      session.user.id,
    );
    client.data.conversationId = conversation.id;
    await client.join(conversationRoom(conversation.id));
  }

  // A client that goes away mid-sentence (closed tab, dead connection)
  // never gets to emit its own "stopped typing" — without this the other
  // side's indicator would be stuck on until the receiver-side safety
  // timeout (see use-typing-indicator.ts) finally clears it.
  handleDisconnect(client: Socket): void {
    const conversationId = client.data.typingConversationId as
      | string
      | undefined;
    if (conversationId) {
      this.broadcastTyping(client, conversationId, false);
    }
  }

  // Called by SupportService right after a message is persisted.
  emitMessage(conversationId: string, message: SupportMessageDto): void {
    this.server
      .to(conversationRoom(conversationId))
      .to(ADMIN_ROOM)
      .emit('message', message);
  }

  // Relayed, never persisted — typing state is ephemeral by nature. Kept
  // deliberately light: the client already debounces so this fires at most
  // once per typing "burst" plus one on idle timeout, not per keystroke.
  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TypingClientPayload,
  ): void {
    const conversationId: string | undefined =
      client.data.role === UserRole.ADMIN
        ? payload.conversationId
        : client.data.conversationId;
    if (!conversationId) return;

    client.data.typingConversationId = payload.isTyping
      ? conversationId
      : undefined;
    this.broadcastTyping(client, conversationId, payload.isTyping);
  }

  private broadcastTyping(
    client: Socket,
    conversationId: string,
    isTyping: boolean,
  ): void {
    const dto: TypingBroadcastDto = {
      conversationId,
      userId: client.data.userId,
      username: client.data.username,
      role: client.data.role,
      isTyping,
    };
    // The sender never needs its own indicator back — broadcast excludes it.
    client
      .to(conversationRoom(conversationId))
      .to(ADMIN_ROOM)
      .emit('typing', dto);
  }

  private async authenticate(client: Socket) {
    const cookie = client.handshake.headers.cookie;
    if (!cookie) return null;
    try {
      const fakeRequest = { headers: { cookie } } as AuthenticatedRequest;
      return await this.authService.readSessionFromRequest(fakeRequest);
    } catch (error) {
      logger.warn(
        { error: error instanceof Error ? error.message : String(error) },
        'Support socket authentication failed',
      );
      return null;
    }
  }
}
