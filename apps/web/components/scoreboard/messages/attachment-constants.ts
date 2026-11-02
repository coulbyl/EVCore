import type { SupportAttachmentKind } from "@/domains/support/types/support";

// Mirrors apps/backend/src/config/storage.constants.ts — purely for
// immediate client-side feedback (no round-trip needed to tell the user a
// file is too big). The backend re-validates independently; this can drift
// slightly loose without being a security issue.
export const ATTACHMENT_LIMITS = {
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
  MAX_AUDIO_BYTES: 15 * 1024 * 1024,
  MAX_FILE_BYTES: 20 * 1024 * 1024,
} as const;

export function attachmentKindForMimeType(
  mimeType: string,
): SupportAttachmentKind {
  if (mimeType.startsWith("image/")) return "IMAGE";
  if (mimeType.startsWith("audio/")) return "AUDIO";
  return "FILE";
}

export function maxBytesForKind(kind: SupportAttachmentKind): number {
  switch (kind) {
    case "IMAGE":
      return ATTACHMENT_LIMITS.MAX_IMAGE_BYTES;
    case "AUDIO":
      return ATTACHMENT_LIMITS.MAX_AUDIO_BYTES;
    case "FILE":
      return ATTACHMENT_LIMITS.MAX_FILE_BYTES;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
