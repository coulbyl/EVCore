import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { SupportAttachmentKind } from '@evcore/db';

// Shape validation only — per-kind mime/size rules (which vary: an image
// caps lower than a generic file) live in SupportService, next to the
// config they check against (config/storage.constants.ts).
export class MessageAttachmentRefDto {
  @IsString()
  objectKey!: string;

  @IsIn(Object.values(SupportAttachmentKind))
  kind!: SupportAttachmentKind;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationMs?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}

// content is optional — a voice note or a bare file has no caption. The
// service rejects a message with neither content nor an attachment.
export class SendMessageDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  content?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MessageAttachmentRefDto)
  attachment?: MessageAttachmentRefDto;
}

export class RequestAttachmentUploadUrlDto {
  @IsIn(Object.values(SupportAttachmentKind))
  kind!: SupportAttachmentKind;

  @IsString()
  @MaxLength(255)
  mimeType!: string;

  @IsInt()
  @Min(1)
  @Max(50 * 1024 * 1024) // hard ceiling — the real, per-kind cap is enforced in SupportService
  sizeBytes!: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;
}
