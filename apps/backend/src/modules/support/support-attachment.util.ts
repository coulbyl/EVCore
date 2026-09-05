import { BadRequestException } from '@nestjs/common';
import { SupportAttachmentKind } from '@evcore/db';
import { SUPPORT_ATTACHMENT_LIMITS } from '@/config/storage.constants';

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/webm': '.webm',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'text/csv': '.csv',
  'application/zip': '.zip',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

export function extensionForMimeType(mimeType: string): string {
  return EXTENSION_BY_MIME_TYPE[mimeType] ?? '';
}

// Rejects an upload request before a presigned URL is even issued — kind,
// declared mime type, and declared size all have to agree with the
// allowlist. The presigned PUT itself is the second, unspoofable check
// (ContentType/ContentLength are signed).
export function assertValidAttachmentRequest(input: {
  kind: SupportAttachmentKind;
  mimeType: string;
  sizeBytes: number;
}): void {
  const { kind, mimeType, sizeBytes } = input;
  const limits = SUPPORT_ATTACHMENT_LIMITS;

  const rules: Record<
    SupportAttachmentKind,
    { allowed: readonly string[]; maxBytes: number }
  > = {
    IMAGE: {
      allowed: limits.ALLOWED_IMAGE_MIME_TYPES,
      maxBytes: limits.MAX_IMAGE_BYTES,
    },
    AUDIO: {
      allowed: limits.ALLOWED_AUDIO_MIME_TYPES,
      maxBytes: limits.MAX_AUDIO_BYTES,
    },
    FILE: {
      allowed: limits.ALLOWED_FILE_MIME_TYPES,
      maxBytes: limits.MAX_FILE_BYTES,
    },
  };

  const rule = rules[kind];
  if (!rule.allowed.includes(mimeType)) {
    throw new BadRequestException(
      `Type de fichier non supporté pour ${kind}: ${mimeType}`,
    );
  }
  if (sizeBytes > rule.maxBytes) {
    throw new BadRequestException(
      `Fichier trop volumineux (max ${Math.floor(rule.maxBytes / (1024 * 1024))} Mo)`,
    );
  }
}
