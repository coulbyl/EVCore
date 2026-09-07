import { FileText } from "lucide-react";
import type { SupportAttachment } from "@/domains/support/types/support";
import { AudioMessagePlayer } from "./audio-message-player";
import { formatFileSize } from "./attachment-constants";

// Renders whatever came back on a message — a real attachment (server URL)
// or a locally-staged one mid-upload (blob: URL, see use-message-composer.ts)
// look identical here, the caller decides whether to also show a progress
// overlay via `uploadProgress`.
export function AttachmentBubble({
  attachment,
  uploadProgress,
}: {
  attachment: SupportAttachment;
  uploadProgress?: number;
}) {
  const isUploading = uploadProgress !== undefined && uploadProgress < 100;

  if (attachment.kind === "IMAGE") {
    return (
      <a
        href={attachment.url}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block w-fit overflow-hidden rounded-lg"
        onClick={(e) => isUploading && e.preventDefault()}
      >
        {/* Dynamic, short-lived presigned URL — Next/Image's remote-pattern
            allowlist + optimization cache add no value here and would need
            reconfiguring per RUSTFS_PUBLIC_ENDPOINT. Same call as UserAvatar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={attachment.url}
          alt={attachment.fileName ?? "Image"}
          className="max-h-64 w-auto max-w-full rounded-lg object-cover"
        />
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-medium text-white">
            {uploadProgress}%
          </div>
        )}
      </a>
    );
  }

  if (attachment.kind === "AUDIO") {
    if (isUploading) {
      return (
        <div className="flex min-w-[220px] items-center gap-2 text-[0.7rem] opacity-80">
          Envoi du message vocal… {uploadProgress}%
        </div>
      );
    }
    return (
      <AudioMessagePlayer
        src={attachment.url}
        durationMs={attachment.durationMs}
      />
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      // `current`-based tint instead of a fixed background — blends into
      // whichever bubble variant wraps it (mine/other) instead of always
      // rendering as the same dark card regardless of context.
      className="flex min-w-[180px] items-center gap-2 rounded-lg bg-current/10 px-3 py-2 transition-colors hover:bg-current/15"
      onClick={(e) => isUploading && e.preventDefault()}
    >
      <FileText size={18} className="shrink-0 opacity-80" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {attachment.fileName ?? "Fichier"}
      </span>
      <span className="shrink-0 text-[0.6rem] opacity-70">
        {isUploading
          ? `${uploadProgress}%`
          : formatFileSize(attachment.sizeBytes)}
      </span>
    </a>
  );
}
