import { FileText, X } from "lucide-react";
import type { ComposerAttachmentInput } from "@/domains/support/use-cases/use-message-composer";
import { formatDuration, formatFileSize } from "./attachment-constants";

// Shown above the textarea once a file is picked, dropped, or a voice note
// finishes recording — "aperçu avant envoi": the user sees exactly what
// they're about to send and can back out before it goes anywhere.
export function ComposerAttachmentPreview({
  attachment,
  previewUrl,
  onRemove,
}: {
  attachment: ComposerAttachmentInput;
  previewUrl: string;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-border bg-secondary/30 px-3 py-2">
      {attachment.kind === "IMAGE" && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob: preview, never a remote/optimizable URL
        <img
          src={previewUrl}
          alt="Aperçu"
          className="h-12 w-12 shrink-0 rounded-md object-cover"
        />
      )}
      {attachment.kind === "AUDIO" && (
        <audio controls src={previewUrl} className="h-9 max-w-[220px] flex-1" />
      )}
      {attachment.kind === "FILE" && (
        <FileText size={20} className="shrink-0 text-muted-foreground" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-foreground">
          {attachment.fileName ??
            (attachment.kind === "AUDIO" ? "Message vocal" : "Fichier")}
        </p>
        <p className="text-[0.65rem] text-muted-foreground">
          {attachment.durationMs != null
            ? formatDuration(attachment.durationMs)
            : formatFileSize(attachment.sizeBytes)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
        aria-label="Retirer la pièce jointe"
      >
        <X size={16} />
      </button>
    </div>
  );
}
