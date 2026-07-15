import { IsUUID } from 'class-validator';

export class StartConversationDto {
  @IsUUID()
  userId!: string;
}
