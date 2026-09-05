// Support chat attachments — voice notes, photos, generic files. Limits
// are enforced twice: once here at request-upload-url time (rejects before
// a presigned URL is even issued), and a second time baked into the
// presigned PUT itself (ContentLength/ContentType are signed parameters —
// RustFS/S3 reject an upload whose real headers don't match, so a client
// can't lie about size or type after getting the URL).
export const SUPPORT_ATTACHMENT_LIMITS = {
  MAX_IMAGE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_AUDIO_BYTES: 15 * 1024 * 1024, // ~30+ min of mono opus at typical bitrates
  MAX_FILE_BYTES: 20 * 1024 * 1024, // 20 MB
  ALLOWED_IMAGE_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ] as const,
  // MediaRecorder's actual output mime type varies by browser (webm/opus on
  // Chrome/Firefox, mp4/aac on Safari) — all three are accepted.
  ALLOWED_AUDIO_MIME_TYPES: [
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
  ] as const,
  ALLOWED_FILE_MIME_TYPES: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ] as const,
  // Presigned PUT — short-lived, the frontend uploads immediately after
  // requesting it.
  UPLOAD_URL_EXPIRY_SECONDS: 5 * 60,
  // Presigned GET — regenerated on every message read/broadcast (see
  // SupportService.toMessageDto), so this only needs to outlive one page
  // view, not the message's lifetime.
  DOWNLOAD_URL_EXPIRY_SECONDS: 15 * 60,
} as const;
