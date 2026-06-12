import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CHAT_LIMITS } from '../chat.constants';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  @MaxLength(CHAT_LIMITS.maxMessageLength)
  content?: string;
}

export class CreateMessageDto {
  @IsString()
  @MaxLength(CHAT_LIMITS.maxMessageLength)
  content!: string;
}

export class ConversationParamDto {
  @IsUUID()
  id!: string;
}
