"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic, Send, Square, X } from "lucide-react";
import { playerFetch } from "@/lib/api/player-fetch";
import { useMessageComposer } from "@/domains/support/use-cases/use-message-composer";
import {
  useVoiceRecorder,
  type VoiceRecorderProblem,
} from "@/domains/support/use-cases/use-voice-recorder";
import type {
  AttachmentUploadUrlResponse,
  SupportMessage,
} from "@/domains/support/types/support";
import {
  attachmentKindForMimeType,
  formatDuration,
  maxBytesForKind,
} from "@/app/dashboard/inbox/components/attachment-constants";
import { MessageBubble } from "./message-bubble";

export type ComposerLabels = {
  placeholder: string;
  send: string;
  photo: string;
  record: string;
  stop: string;
  recording: string;
  sendVoice: string;
  cancel: string;
  sending: string;
  failed: string;
  retry: string;
  tooBig: string;
  /** What the microphone's failure was, said as it is. */
  mic: Record<VoiceRecorderProblem, string>;
  voice: string;
  image: string;
  file: string;
  automatic: string;
};

/**
 * Writing to the team (09 § 2): text, a photo, a voice message (tap to
 * start, tap to stop, listen, send). A message shows at once and stays
 * while it uploads; a failure keeps it with « Réessayer ». Sent messages
 * stay here until the server's thread, read again, carries them.
 */
export function Composer({
  serverIds,
  labels,
  timeFormat,
}: {
  /** The ids the server's thread already shows. */
  serverIds: readonly string[];
  labels: ComposerLabels;
  timeFormat: { locale: string; timeZone: string };
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [sent, setSent] = useState<SupportMessage[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const recorder = useVoiceRecorder();
  // One address per recording, released when it goes.
  const previewUrl = useMemo(
    () =>
      recorder.previewBlob ? URL.createObjectURL(recorder.previewBlob) : null,
    [recorder.previewBlob],
  );
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const composer = useMessageComposer({
    senderRole: "OPERATOR",
    requestUploadUrl: async (meta) =>
      (await playerFetch<AttachmentUploadUrlResponse>(
        "/support/attachments/upload-url",
        { method: "POST", body: meta },
      )) as AttachmentUploadUrlResponse,
    sendFn: async (input) =>
      (await playerFetch<SupportMessage>("/support/messages", {
        method: "POST",
        body: input,
      })) as SupportMessage,
    onSent: (message) => {
      setSent((list) => [...list, message]);
      router.refresh();
    },
  });

  const time = (iso: string) =>
    new Intl.DateTimeFormat(timeFormat.locale, {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: timeFormat.timeZone,
    }).format(new Date(iso));

  function sendText() {
    const content = text.trim();
    if (!content) return;
    composer.send(content);
    setText("");
  }

  function sendPhoto(file: File | undefined) {
    setProblem(null);
    if (!file) return;
    const kind = attachmentKindForMimeType(file.type);
    if (file.size > maxBytesForKind(kind)) {
      setProblem(labels.tooBig);
      return;
    }
    composer.send(undefined, {
      file,
      kind,
      mimeType: file.type,
      sizeBytes: file.size,
      fileName: file.name,
    });
  }

  function sendVoice() {
    const blob = recorder.previewBlob;
    if (!blob) return;
    const mimeType = blob.type.split(";")[0] ?? "audio/webm";
    if (blob.size > maxBytesForKind("AUDIO")) {
      setProblem(labels.tooBig);
      return;
    }
    composer.send(undefined, {
      file: blob,
      kind: "AUDIO",
      mimeType,
      sizeBytes: blob.size,
      durationMs: recorder.elapsedMs,
    });
    recorder.reset();
  }

  const bubbleLabels = {
    voice: labels.voice,
    image: labels.image,
    file: labels.file,
    automatic: labels.automatic,
  };
  const waiting = sent.filter((m) => !serverIds.includes(m.id));

  return (
    <>
      {waiting.length + composer.pending.length > 0 ? (
        <ul className="flex flex-col gap-3 pb-3">
          {waiting.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine
              sign={null}
              time={time(message.createdAt)}
              labels={bubbleLabels}
            />
          ))}
          {composer.pending.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              mine
              sign={null}
              time={time(message.createdAt)}
              labels={bubbleLabels}
              footer={
                message.status === "failed" ? (
                  <p className="flex items-center gap-2 text-meta">
                    {labels.failed}
                    <button
                      type="button"
                      onClick={() => composer.retry(message.id)}
                      className="font-medium underline underline-offset-4"
                    >
                      {labels.retry}
                    </button>
                  </p>
                ) : (
                  <p className="text-meta text-muted-foreground">
                    {labels.sending}
                    {message.uploadProgress !== undefined
                      ? ` ${message.uploadProgress} %`
                      : null}
                  </p>
                )
              }
            />
          ))}
        </ul>
      ) : null}

      <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] -mx-4 flex flex-col gap-1 border-t border-border bg-background px-4 py-2 lg:bottom-0">
        {problem || recorder.state === "error" ? (
          <p role="alert" className="text-meta">
            {problem ?? labels.mic[recorder.problem ?? "unknown"]}
          </p>
        ) : null}
        {recorder.state === "recording" ? (
          <div className="flex min-h-12 items-center gap-3">
            <span
              className="size-2.5 animate-pulse rounded-full bg-loss"
              aria-hidden
            />
            <span className="score flex-1 text-bet" aria-live="polite">
              {labels.recording} {formatDuration(recorder.elapsedMs)}
            </span>
            <IconButton label={labels.stop} onClick={recorder.stop}>
              <Square aria-hidden className="size-5" />
            </IconButton>
          </div>
        ) : recorder.state === "preview" && previewUrl ? (
          <div className="flex min-h-12 items-center gap-2">
            <audio controls src={previewUrl} className="min-w-0 flex-1" />
            <IconButton label={labels.cancel} onClick={recorder.reset}>
              <X aria-hidden className="size-5" />
            </IconButton>
            <IconButton label={labels.sendVoice} onClick={sendVoice} primary>
              <Send aria-hidden className="size-5" />
            </IconButton>
          </div>
        ) : (
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              sendText();
            }}
          >
            <IconButton
              label={labels.photo}
              onClick={() => photoInput.current?.click()}
            >
              <Camera aria-hidden className="size-5" />
            </IconButton>
            <input
              ref={photoInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                sendPhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendText();
                }
              }}
              rows={1}
              maxLength={4000}
              placeholder={labels.placeholder}
              aria-label={labels.placeholder}
              className="field-sizing-content max-h-36 min-h-11 flex-1 resize-none rounded-[1.25rem] border border-border bg-card px-4 py-2.5 text-body focus:outline-2 focus:outline-ring"
            />
            {text.trim() ? (
              <IconButton label={labels.send} type="submit" primary>
                <Send aria-hidden className="size-5" />
              </IconButton>
            ) : (
              <IconButton label={labels.record} onClick={recorder.start}>
                <Mic aria-hidden className="size-5" />
              </IconButton>
            )}
          </form>
        )}
      </div>
    </>
  );
}

function IconButton({
  label,
  onClick,
  type = "button",
  primary = false,
  children,
}: {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit";
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={label}
      className={
        primary
          ? "flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          : "flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      }
    >
      {children}
    </button>
  );
}
