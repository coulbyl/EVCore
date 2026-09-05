import { FileText } from "lucide-react";
import type { SupportAttachment } from "@/domains/support/types/support";
import { formatDuration, formatFileSize } from "./attachment-constants";

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
    return (
      <div className="flex min-w-[220px] flex-col gap-1">
        <audio controls src={attachment.url} className="h-10 w-full" />
        {isUploading ? (
          <span className="text-[0.65rem] text-muted-foreground">
            Envoi… {uploadProgress}%
          </span>
        ) : (
          attachment.durationMs != null && (
            <span className="text-[0.65rem] text-muted-foreground">
              {formatDuration(attachment.durationMs)}
            </span>
          )
        )}
      </div>
    );
  }

  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-w-[180px] items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 hover:bg-background/70"
      onClick={(e) => isUploading && e.preventDefault()}
    >
      <FileText size={18} className="shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate text-xs font-medium">
        {attachment.fileName ?? "Fichier"}
      </span>
      <span className="shrink-0 text-[0.6rem] text-muted-foreground">
        {isUploading
          ? `${uploadProgress}%`
          : formatFileSize(attachment.sizeBytes)}
      </span>
    </a>
  );
}
