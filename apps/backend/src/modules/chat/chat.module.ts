import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { CouponModule } from '@modules/coupon/coupon.module';
import { ChatController } from './chat.controller';
import { ChatRepository } from './chat.repository';
import { ChatRateLimitService } from './chat.rate-limit.service';
import { ChatReadRepository } from './chat.read.repository';
import { ChatToolsService } from './chat.tools.service';
import { ChatPickEngineService } from './chat.pick-engine.service';
import { ChatService } from './chat.service';
import { GroqLlmClient } from './groq-llm.client';
import { LLM_CLIENT } from './chat.tokens';

@Module({
  imports: [PrismaModule, AuthModule, CouponModule],
  controllers: [ChatController],
  providers: [
    ChatRepository,
    ChatRateLimitService,
    ChatReadRepository,
    ChatPickEngineService,
    ChatToolsService,
    ChatService,
    GroqLlmClient,
    { provide: LLM_CLIENT, useExisting: GroqLlmClient },
  ],
})
export class ChatModule {}
