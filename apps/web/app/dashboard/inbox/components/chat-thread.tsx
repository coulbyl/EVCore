"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, CheckCheck, Send } from "lucide-react";
import { Skeleton } from "@evcore/ui";
import { cn } from "@evcore/ui/cn";
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

function isGroupedWithPrevious(
  messages: SupportMessage[],
  index: number,
): boolean {
  if (index === 0) return false;
  const prev = messages[index - 1];
  const current = messages[index];
  if (!prev || !current || prev.senderRole !== current.senderRole) {
    return false;
  }
  const gapMs =
    new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime();
  return gapMs < GROUP_WINDOW_MS;
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages?.length]);

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

      <div
        ref={scrollRef}
        className="min-w-0 flex-1 overflow-y-auto bg-background/40 px-4 py-3"
      >
        {isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-14 w-2/3 rounded-2xl" />
            <Skeleton className="h-14 w-1/2 self-end rounded-2xl" />
          </div>
        )}
        {!isLoading && (messages?.length ?? 0) === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        )}
        {dayGroups.map((group) => (
          <div key={group.dayLabel}>
            <div className="my-3 flex justify-center">
              <span className="rounded-full bg-secondary px-3 py-1 text-[0.65rem] font-medium text-muted-foreground">
                {group.dayLabel}
              </span>
            </div>
            <div className="flex flex-col">
              {group.messages.map((message, index) => {
                const isMine = message.senderRole === currentRole;
                const grouped = isGroupedWithPrevious(group.messages, index);
                const isRead =
                  isMine &&
                  !!otherReadAt &&
                  new Date(message.createdAt) <= new Date(otherReadAt);
                return (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      isMine ? "justify-end" : "justify-start",
                      grouped ? "mt-0.5" : "mt-2",
                    )}
                  >
                    <div
                      className={cn(
                        "flex max-w-[75%] flex-col gap-1.5 rounded-2xl px-3 py-2 text-sm shadow-sm",
                        isMine
                          ? "bg-accent text-accent-foreground rounded-br-md"
                          : "bg-secondary text-foreground rounded-bl-md",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">
                        {message.content}
                      </p>
                      <span className="flex items-center gap-1 self-end text-[0.6rem] opacity-70">
                        {formatTime(message.createdAt)}
                        {isMine &&
                          (isRead ? (
                            <CheckCheck size={12} className="text-sky-300" />
                          ) : (
                            <Check size={12} />
                          ))}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-border p-3">
        <textarea
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
          className="max-h-40 min-h-10 flex-1 resize-none rounded-xl border border-border bg-panel px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={!draft.trim() || isSending}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground disabled:opacity-50"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
