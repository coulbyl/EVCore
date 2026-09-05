"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
  ChevronUp,
  Loader2,
  RotateCw,
  Send,
  WifiOff,
} from "lucide-react";
import {
  Bubble,
  BubbleContent,
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
  Marker,
  Message,
  MessageContent,
  MessageFooter,
  MessageGroup,
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
  Skeleton,
} from "@evcore/ui";
import { cn } from "@evcore/ui/cn";
import { formatDayLabel, formatTime } from "@/lib/date";
import type { SupportMessage } from "@/domains/support/types/support";
import type { ComposerAttachmentInput } from "@/domains/support/use-cases/use-message-composer";
import { useVoiceRecorder } from "@/domains/support/use-cases/use-voice-recorder";
import { AttachmentBubble } from "./attachment-bubble";
import { AttachmentPickerButton } from "./attachment-picker-button";
import {
  attachmentKindForMimeType,
  maxBytesForKind,
} from "./attachment-constants";
import { ComposerAttachmentPreview } from "./composer-attachment-preview";
import { findFirstUnreadMessageId } from "./message-content-constants";
import { MessageText } from "./message-text";
import { MicButton, VoiceRecorderBar } from "./voice-recorder-bar";

// Consecutive messages from the same sender within this window are visually
// grouped (tight spacing, one bubble reads as a "burst") — WhatsApp-style.
const GROUP_WINDOW_MS = 5 * 60_000;

type DayGroup = {
  dayLabel: string;
  messages: SupportMessage[];
};

function groupByDay(messages: SupportMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const message of messages) {
    const dayLabel = formatDayLabel(message.createdAt);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.dayLabel === dayLabel) {
      lastGroup.messages.push(message);
    } else {
      groups.push({ dayLabel, messages: [message] });
    }
  }
  return groups;
}

// One burst = consecutive messages from the same sender within the group
// window — rendered as one MessageGroup so they read as a single "turn".
// An automated message never joins a burst — it always stands on its own,
// centered, regardless of who sent the message before or after it.
function groupIntoBursts(messages: SupportMessage[]): SupportMessage[][] {
  const bursts: SupportMessage[][] = [];
  for (const message of messages) {
    const lastBurst = bursts[bursts.length - 1];
    const lastMessage = lastBurst?.[lastBurst.length - 1];
    const sameBurst =
      lastMessage &&
      message.kind !== "AUTOMATED" &&
      lastMessage.kind !== "AUTOMATED" &&
      lastMessage.senderRole === message.senderRole &&
      new Date(message.createdAt).getTime() -
        new Date(lastMessage.createdAt).getTime() <
        GROUP_WINDOW_MS;
    if (sameBurst && lastBurst) {
      lastBurst.push(message);
    } else {
      bursts.push([message]);
    }
  }
  return bursts;
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1 animate-bounce rounded-full bg-current"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

// Admin-only visual: an automated message (welcome, future reminders…)
// stands out from a human reply so staff never mistake one for the other —
// but this label is deliberately never shown on the operator's own side,
// where it should read exactly like a message from the team.
function AutomatedMessageBubble({ message }: { message: SupportMessage }) {
  return (
    <div className="flex w-full justify-center py-1">
      <div className="flex max-w-[85%] flex-col items-center gap-1">
        <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
          <Bot size={12} /> Message automatique
        </span>
        <Bubble variant="muted" align="start">
          <BubbleContent className="text-center">
            {message.content && <MessageText content={message.content} />}
          </BubbleContent>
        </Bubble>
        <span className="text-[0.6rem] text-muted-foreground">
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}

// Shared message list + composer, used by both the operator's single-thread
// inbox and the admin's per-conversation thread — keeps the chat experience
// (bubble layout, day dividers, grouping, timestamps, attachments) identical
// everywhere.
export function ChatThread({
  conversationId,
  messages,
  pendingMessages,
  isLoading,
  currentRole,
  onSend,
  onRetryPending,
  onDiscardPending,
  hasMore,
  isLoadingOlder,
  onLoadOlder,
  placeholder,
  emptyMessage,
  header,
  otherReadAt,
  myReadAt,
  typingLabel,
  isConnected = true,
  onDraftActivity,
  onDraftIdle,
}: {
  conversationId: string | undefined;
  messages: SupportMessage[] | undefined;
  // Optimistic messages currently in flight or failed — merged into the
  // thread visually, never part of the confirmed `messages` array.
  pendingMessages?: SupportMessage[];
  isLoading: boolean;
  currentRole: "ADMIN" | "OPERATOR";
  onSend: (
    content: string | undefined,
    attachment?: ComposerAttachmentInput,
  ) => void;
  onRetryPending?: (localId: string) => void;
  onDiscardPending?: (localId: string) => void;
  // "Load older messages" — omit hasMore/onLoadOlder to hide the control.
  hasMore?: boolean;
  isLoadingOlder?: boolean;
  onLoadOlder?: () => void;
  placeholder: string;
  emptyMessage: string;
  header?: ReactNode;
  // Last time the other side opened this conversation — lets "my" messages
  // show a read receipt (WhatsApp-style double check) once it's past their
  // watermark. No separate "delivered" state exists, so it's a 2-state
  // indicator: sent (grey single check) vs read (blue double check).
  otherReadAt?: string | null;
  // My own last-read watermark, captured before this visit — powers the
  // "Nouveaux messages" divider (see findFirstUnreadMessageId).
  myReadAt?: string | null;
  // e.g. "Léa est en train d'écrire…" — null/undefined hides the row
  // entirely rather than reserving empty space for it.
  typingLabel?: string | null;
  isConnected?: boolean;
  onDraftActivity?: () => void;
  onDraftIdle?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [stagedAttachment, setStagedAttachment] =
    useState<ComposerAttachmentInput | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const stagedPreviewUrlRef = useRef<string | null>(null);
  const dragCounterRef = useRef(0);
  const recorder = useVoiceRecorder();

  // Auto-grow with content, capped so a long paste doesn't swallow the thread.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  function stageAttachment(input: ComposerAttachmentInput) {
    if (stagedPreviewUrlRef.current)
      URL.revokeObjectURL(stagedPreviewUrlRef.current);
    const url = URL.createObjectURL(input.file);
    stagedPreviewUrlRef.current = url;
    setStagedPreviewUrl(url);
    setStagedAttachment(input);
  }

  function clearStaged() {
    if (stagedPreviewUrlRef.current) {
      URL.revokeObjectURL(stagedPreviewUrlRef.current);
      stagedPreviewUrlRef.current = null;
    }
    setStagedPreviewUrl(null);
    setStagedAttachment(null);
  }

  // Cleanup on unmount only — clearStaged() itself already revokes on every
  // explicit removal (send/cancel/pick-another).
  useEffect(() => {
    return () => {
      if (stagedPreviewUrlRef.current)
        URL.revokeObjectURL(stagedPreviewUrlRef.current);
    };
  }, []);

  function handleFile(file: File) {
    const kind = attachmentKindForMimeType(
      file.type || "application/octet-stream",
    );
    const maxBytes = maxBytesForKind(kind);
    if (file.size > maxBytes) {
      setAttachmentError(
        `Fichier trop volumineux (max ${Math.round(maxBytes / (1024 * 1024))} Mo)`,
      );
      return;
    }
    setAttachmentError(null);
    stageAttachment({
      file,
      kind,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      fileName: file.name,
    });
  }

  // Voice recording reaching "preview" hands off to the same staged-preview
  // UI as a picked file — one send/discard flow for both, instead of two.
  useEffect(() => {
    if (!recorder.previewBlob) return;
    const blob = recorder.previewBlob;
    stageAttachment({
      file: blob,
      kind: "AUDIO",
      mimeType: blob.type.split(";")[0] || "audio/webm",
      sizeBytes: blob.size,
      durationMs: recorder.elapsedMs,
    });
    recorder.reset();
    // stageAttachment/recorder.reset are stable-enough closures here; only
    // previewBlob transitions should trigger this hand-off.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder.previewBlob]);

  function handleSend() {
    const content = draft.trim();
    if (!content && !stagedAttachment) return;
    setDraft("");
    onDraftIdle?.();
    onSend(content || undefined, stagedAttachment ?? undefined);
    clearStaged();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const allMessages = useMemo(() => {
    if (!pendingMessages || pendingMessages.length === 0) return messages;
    return [...(messages ?? []), ...pendingMessages].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [messages, pendingMessages]);

  // Locked in once per conversation — recomputed only when the thread
  // itself changes, not on every new message or read-receipt update, so the
  // marker doesn't jump or vanish mid-session (see helper for the exact
  // rule: first message from the other side newer than my watermark).
  const dividerMessageId = useMemo(
    () => findFirstUnreadMessageId({ messages, myReadAt, currentRole }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId],
  );

  const dayGroups = allMessages ? groupByDay(allMessages) : [];
  const isRecording = recorder.state === "recording";

  return (
    <div
      className="relative flex h-full w-full min-w-0 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounterRef.current += 1;
        setIsDraggingFile(true);
      }}
      onDragLeave={() => {
        dragCounterRef.current -= 1;
        if (dragCounterRef.current <= 0) setIsDraggingFile(false);
      }}
      onDrop={handleDrop}
    >
      {isDraggingFile && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 text-sm font-medium text-primary">
          Déposez le fichier ici
        </div>
      )}

      {header}

      {!isConnected && (
        <div className="flex items-center gap-2 border-b border-border bg-warning/10 px-4 py-1.5 text-xs text-warning">
          <WifiOff size={13} className="shrink-0" />
          Connexion perdue — reconnexion en cours…
        </div>
      )}

      <div className="min-h-0 min-w-0 flex-1 bg-background/40">
        {isLoading && (
          <div className="flex flex-col gap-2 px-4 py-3">
            <Skeleton className="h-14 w-2/3 rounded-2xl" />
            <Skeleton className="h-14 w-1/2 self-end rounded-2xl" />
          </div>
        )}
        {!isLoading && (allMessages?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
        {!isLoading && (allMessages?.length ?? 0) > 0 && (
          <MessageScrollerProvider>
            <MessageScroller>
              <MessageScrollerViewport>
                <MessageScrollerContent className="gap-3 px-4 py-3">
                  {hasMore && (
                    <div className="flex justify-center pb-2">
                      <button
                        type="button"
                        onClick={onLoadOlder}
                        disabled={isLoadingOlder}
                        className="flex items-center gap-1 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-60"
                      >
                        {isLoadingOlder ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <ChevronUp size={12} />
                        )}
                        Charger les messages précédents
                      </button>
                    </div>
                  )}
                  {dayGroups.map((group) => (
                    <div key={group.dayLabel} className="flex flex-col gap-2">
                      <Marker variant="separator" className="my-2">
                        {group.dayLabel}
                      </Marker>
                      {groupIntoBursts(group.messages).map((burst) => {
                        const first = burst[0];
                        if (!first) return null;

                        if (first.kind === "AUTOMATED") {
                          return (
                            <MessageScrollerItem
                              key={first.id}
                              messageId={first.id}
                            >
                              {currentRole === "ADMIN" ? (
                                <AutomatedMessageBubble message={first} />
                              ) : (
                                // Operator side: reads like any other reply
                                // from the team, no "automatic" tell.
                                <Message align="start">
                                  <MessageContent>
                                    <Bubble align="start" variant="secondary">
                                      <BubbleContent className="rounded-bl-md">
                                        {first.content && (
                                          <MessageText
                                            content={first.content}
                                          />
                                        )}
                                      </BubbleContent>
                                    </Bubble>
                                    <MessageFooter className="gap-1 text-[0.6rem]">
                                      {formatTime(first.createdAt)}
                                    </MessageFooter>
                                  </MessageContent>
                                </Message>
                              )}
                            </MessageScrollerItem>
                          );
                        }

                        const isMine = first.senderRole === currentRole;
                        return (
                          <MessageScrollerItem
                            key={first.id}
                            messageId={first.id}
                            scrollAnchor={isMine}
                          >
                            <MessageGroup>
                              {burst.map((message) => {
                                const isRead =
                                  isMine &&
                                  !!otherReadAt &&
                                  new Date(message.createdAt) <=
                                    new Date(otherReadAt);
                                return (
                                  <div key={message.id}>
                                    {message.id === dividerMessageId && (
                                      <Marker
                                        variant="separator"
                                        className="my-2"
                                      >
                                        Nouveaux messages
                                      </Marker>
                                    )}
                                    <Message align={isMine ? "end" : "start"}>
                                      <MessageContent>
                                        <Bubble
                                          align={isMine ? "end" : "start"}
                                          variant={
                                            isMine ? "default" : "secondary"
                                          }
                                          className={cn(
                                            message.status === "sending" &&
                                              "opacity-70",
                                          )}
                                        >
                                          <BubbleContent
                                            className={
                                              isMine
                                                ? "rounded-br-md"
                                                : "rounded-bl-md"
                                            }
                                          >
                                            {message.attachment && (
                                              <AttachmentBubble
                                                attachment={message.attachment}
                                                uploadProgress={
                                                  message.status === "sending"
                                                    ? message.uploadProgress
                                                    : undefined
                                                }
                                              />
                                            )}
                                            {message.content && (
                                              <MessageText
                                                content={message.content}
                                              />
                                            )}
                                          </BubbleContent>
                                        </Bubble>
                                        <MessageFooter className="gap-1 text-[0.6rem]">
                                          {message.status === "failed" ? (
                                            <span className="flex items-center gap-1.5 text-danger">
                                              <AlertCircle size={11} />
                                              Échec
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  onRetryPending?.(message.id)
                                                }
                                                className="flex items-center gap-0.5 underline hover:opacity-80"
                                              >
                                                Réessayer
                                                <RotateCw size={10} />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  onDiscardPending?.(message.id)
                                                }
                                                className="underline hover:opacity-80"
                                              >
                                                Supprimer
                                              </button>
                                            </span>
                                          ) : (
                                            <>
                                              {formatTime(message.createdAt)}
                                              {isMine &&
                                                (message.status ===
                                                "sending" ? (
                                                  <Loader2
                                                    size={12}
                                                    className="animate-spin"
                                                  />
                                                ) : isRead ? (
                                                  <CheckCheck
                                                    size={12}
                                                    className="text-sky-300"
                                                  />
                                                ) : (
                                                  <Check size={12} />
                                                ))}
                                            </>
                                          )}
                                        </MessageFooter>
                                      </MessageContent>
                                    </Message>
                                  </div>
                                );
                              })}
                            </MessageGroup>
                          </MessageScrollerItem>
                        );
                      })}
                    </div>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton />
            </MessageScroller>
          </MessageScrollerProvider>
        )}
      </div>

      {typingLabel && !isRecording && (
        <div className="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
          {typingLabel} <TypingDots />
        </div>
      )}

      {recorder.error && (
        <div className="border-t border-border px-4 py-1.5 text-xs text-danger">
          {recorder.error}
        </div>
      )}
      {attachmentError && (
        <div className="border-t border-border px-4 py-1.5 text-xs text-danger">
          {attachmentError}
        </div>
      )}

      {stagedAttachment && stagedPreviewUrl && !isRecording && (
        <ComposerAttachmentPreview
          attachment={stagedAttachment}
          previewUrl={stagedPreviewUrl}
          onRemove={clearStaged}
        />
      )}

      <div className="border-t border-border p-3">
        {isRecording ? (
          <VoiceRecorderBar
            elapsedMs={recorder.elapsedMs}
            onStop={recorder.stop}
            onCancel={recorder.cancel}
          />
        ) : (
          <InputGroup>
            <InputGroupTextarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => {
                setDraft(e.target.value);
                if (e.target.value.trim()) {
                  onDraftActivity?.();
                } else {
                  onDraftIdle?.();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={placeholder}
              rows={1}
              className="max-h-40"
            />
            <InputGroupAddon align="block-end">
              <AttachmentPickerButton
                onPick={handleFile}
                disabled={!!stagedAttachment}
              />
              <MicButton
                onClick={() => void recorder.start()}
                disabled={!!stagedAttachment}
              />
              <InputGroupButton
                type="button"
                variant="default"
                size="icon-sm"
                className="ml-auto"
                onClick={handleSend}
                disabled={!draft.trim() && !stagedAttachment}
              >
                <Send />
                <span className="sr-only">Envoyer</span>
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        )}
      </div>
    </div>
  );
}
