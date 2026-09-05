import { useRef } from "react";
import { Paperclip } from "lucide-react";

// Everything the backend allowlists (config/storage.constants.ts) — images,
// common document formats, archives. The backend re-validates regardless;
// this `accept` is just a picker filter, not a security boundary.
const ACCEPT =
  "image/jpeg,image/png,image/webp,image/gif,application/pdf,text/plain,text/csv,application/zip,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function AttachmentPickerButton({
  onPick,
  disabled,
}: {
  onPick: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Joindre un fichier"
      >
        <Paperclip size={18} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // allow picking the same file twice in a row
          if (file) onPick(file);
        }}
      />
    </>
  );
}
