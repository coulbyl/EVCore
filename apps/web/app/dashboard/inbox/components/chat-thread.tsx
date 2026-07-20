"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, CheckCheck, Send } from "lucide-react";
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
import { formatDayLabel, formatTime } from "@/lib/date";
import type { SupportMessage } from "@/domains/support/types/support";

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
function groupIntoBursts(messages: SupportMessage[]): SupportMessage[][] {
  const bursts: SupportMessage[][] = [];
  for (const message of messages) {
    const lastBurst = bursts[bursts.length - 1];
    const lastMessage = lastBurst?.[lastBurst.length - 1];
    const sameBurst =
      lastMessage &&
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

// Shared message list + composer, used by both the operator's single-thread
// inbox and the admin's per-conversation thread — keeps the chat experience
// (bubble layout, day dividers, grouping, timestamps) identical everywhere.
export function ChatThread({
  messages,
  isLoading,
  currentRole,
  onSend,
  isSending,
  placeholder,
  emptyMessage,
  header,
  otherReadAt,
}: {
  messages: SupportMessage[] | undefined;
  isLoading: boolean;
  currentRole: "ADMIN" | "OPERATOR";
  onSend: (content: string) => Promise<void>;
  isSending: boolean;
  placeholder: string;
  emptyMessage: string;
  header?: ReactNode;
  // Last time the other side opened this conversation — lets "my" messages
  // show a read receipt (WhatsApp-style double check) once it's past their
  // watermark. No separate "delivered" state exists, so it's a 2-state
  // indicator: sent (grey single check) vs read (blue double check).
  otherReadAt?: string | null;
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

  async function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    await onSend(content);
  }

  const dayGroups = messages ? groupByDay(messages) : [];

  return (
    <div className="flex h-full w-full min-w-0 flex-col">
      {header}

      <div className="min-h-0 min-w-0 flex-1 bg-background/40">
        {isLoading && (
          <div className="flex flex-col gap-2 px-4 py-3">
            <Skeleton className="h-14 w-2/3 rounded-2xl" />
            <Skeleton className="h-14 w-1/2 self-end rounded-2xl" />
          </div>
        )}
        {!isLoading && (messages?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
        {!isLoading && (messages?.length ?? 0) > 0 && (
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
                                  <Message
                                    key={message.id}
                                    align={isMine ? "end" : "start"}
                                  >
                                    <MessageContent>
                                      <Bubble
                                        align={isMine ? "end" : "start"}
                                        variant={
                                          isMine ? "default" : "secondary"
                                        }
                                      >
                                        <BubbleContent
                                          className={
                                            isMine
                                              ? "rounded-br-md"
                                              : "rounded-bl-md"
                                          }
                                        >
                                          <p className="whitespace-pre-wrap break-words">
                                            {message.content}
                                          </p>
                                        </BubbleContent>
                                      </Bubble>
                                      <MessageFooter className="gap-1 text-[0.6rem]">
                                        {formatTime(message.createdAt)}
                                        {isMine &&
                                          (isRead ? (
                                            <CheckCheck
                                              size={12}
                                              className="text-sky-300"
                                            />
                                          ) : (
                                            <Check size={12} />
                                          ))}
                                      </MessageFooter>
                                    </MessageContent>
                                  </Message>
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

      <div className="border-t border-border p-3">
        <InputGroup>
          <InputGroupTextarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
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
              onClick={() => void handleSend()}
              disabled={!draft.trim() || isSending}
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
