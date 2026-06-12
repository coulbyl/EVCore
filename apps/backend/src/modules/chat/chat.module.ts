import { Module } from '@nestjs/common';
import { PrismaModule } from '@/prisma.module';
import { AuthModule } from '@modules/auth/auth.module';
import { AiEngineModule } from '@modules/ai-engine/ai-engine.module';
import { ChatController } from './chat.controller';
import { ChatRepository } from './chat.repository';
import { ChatReadRepository } from './chat.read.repository';
import { ChatToolsService } from './chat.tools.service';
import { ChatPickEngineService } from './chat.pick-engine.service';
import { ChatService } from './chat.service';
import { GroqLlmClient } from './groq-llm.client';
import { LLM_CLIENT } from './chat.tokens';

@Module({
  imports: [PrismaModule, AuthModule, AiEngineModule],
  controllers: [ChatController],
  providers: [
    ChatRepository,
    ChatReadRepository,
    ChatPickEngineService,
    ChatToolsService,
    ChatService,
    GroqLlmClient,
    { provide: LLM_CLIENT, useExisting: GroqLlmClient },
  ],
})
export class ChatModule {}
