"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCheck,
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
import { findFirstUnreadMessageId } from "./message-content-constants";
import { MessageText } from "./message-text";

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
            <MessageText content={message.content} />
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
// (bubble layout, day dividers, grouping, timestamps) identical everywhere.
export function ChatThread({
  conversationId,
  messages,
  pendingMessages,
  isLoading,
  currentRole,
  onSend,
  onRetryPending,
  onDiscardPending,
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
  onSend: (content: string) => void;
  onRetryPending?: (localId: string) => void;
  onDiscardPending?: (localId: string) => void;
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow with content, capped so a long paste doesn't swallow the thread.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    onDraftIdle?.();
    onSend(content);
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

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
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
                                        <MessageText content={first.content} />
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
                                            <MessageText
                                              content={message.content}
                                            />
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

      {typingLabel && (
        <div className="flex items-center gap-1.5 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
          {typingLabel} <TypingDots />
        </div>
      )}

      <div className="border-t border-border p-3">
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
            <InputGroupButton
              type="button"
              variant="default"
              size="icon-sm"
              className="ml-auto"
              onClick={handleSend}
              disabled={!draft.trim()}
            >
              <Send />
              <span className="sr-only">Envoyer</span>
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </div>
    </div>
  );
}
