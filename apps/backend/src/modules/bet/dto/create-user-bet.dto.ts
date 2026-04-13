import { IsString, IsUUID } from 'class-validator';

export class CreateUserBetDto {
  @IsUUID()
  modelRunId!: string;

  @IsString()
  market!: string;

  @IsString()
  pick!: string;
}
