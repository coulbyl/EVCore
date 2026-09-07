import { Mic, Square, Trash2 } from "lucide-react";
import { formatDuration } from "./attachment-constants";

// Replaces the textarea row while actively recording — a live timer and a
// pulsing dot make it unambiguous that the mic is on, with cancel always one
// tap away (discards the recording entirely, no confirmation needed since
// nothing has been sent or even staged yet).
export function VoiceRecorderBar({
  elapsedMs,
  onStop,
  onCancel,
}: {
  elapsedMs: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-1 items-center gap-3 px-1 py-2">
      <button
        type="button"
        onClick={onCancel}
        className="shrink-0 rounded-full p-2 text-muted-foreground hover:bg-secondary hover:text-danger"
        aria-label="Annuler l'enregistrement"
      >
        <Trash2 size={18} />
      </button>
      <div className="flex flex-1 items-center gap-2">
        <span className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-danger" />
        </span>
        <span className="font-mono text-sm text-foreground">
          {formatDuration(elapsedMs)}
        </span>
        <span className="text-xs text-muted-foreground">Enregistrement…</span>
      </div>
      <button
        type="button"
        onClick={onStop}
        className="flex shrink-0 items-center justify-center rounded-full bg-primary p-2 text-primary-foreground hover:bg-primary/90"
        aria-label="Arrêter l'enregistrement"
      >
        <Square size={16} fill="currentColor" />
      </button>
    </div>
  );
}

export function MicButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Message vocal"
    >
      <Mic size={18} />
    </button>
  );
}
