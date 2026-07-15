import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { UserRole } from '@evcore/db';
import { AuthService } from '@modules/auth/auth.service';
import type { AuthenticatedRequest } from '@modules/auth/auth.types';
import { createLogger } from '@utils/logger';
import { SupportRepository } from './support.repository';
import type { SupportMessageDto } from './support.types';

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

  handleDisconnect(): void {
    // No per-connection cleanup needed — rooms are torn down by socket.io
    // automatically on disconnect.
  }

  // Called by SupportService right after a message is persisted.
  emitMessage(conversationId: string, message: SupportMessageDto): void {
    this.server
      .to(conversationRoom(conversationId))
      .to(ADMIN_ROOM)
      .emit('message', message);
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
