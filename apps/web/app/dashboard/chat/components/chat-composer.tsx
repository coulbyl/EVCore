"use client";

import { useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { Button, cn } from "@evcore/ui";
import { CHAT_CONTENT_MAX_WIDTH, CHAT_MAX_CHARS } from "./chat-constants";

export function ChatComposer({
  streaming,
  onSend,
  onStop,
}: {
  streaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const tooLong = value.length > CHAT_MAX_CHARS;
  const canSend = value.trim().length > 0 && !tooLong && !streaming;

  function send() {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
  }

  return (
    <div className={cn("mx-auto w-full", CHAT_CONTENT_MAX_WIDTH)}>
      <div className="rounded-2xl border border-border bg-card p-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder="Écrire à EVA…"
          className="max-h-40 w-full resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between px-1">
          <span
            className={cn(
              "text-[0.65rem]",
              tooLong ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {value.length}/{CHAT_MAX_CHARS}
          </span>
          {streaming ? (
            <Button size="sm" variant="secondary" onClick={onStop}>
              <Square className="size-3.5" /> Stop
            </Button>
          ) : (
            <Button size="sm" onClick={send} disabled={!canSend}>
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
      </div>
      <p className="mt-2 text-center text-[0.65rem] text-muted-foreground">
        EVA restitue les analyses du moteur EVCore. Aucun gain n&apos;est
        garanti. Pariez de manière responsable.
      </p>
    </div>
  );
}
