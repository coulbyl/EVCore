"use client";

import { Megaphone } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { UserAnnouncement } from "@/domains/announcements/types/announcements";

export function UpdateRow({
  announcement,
  isReadLabel,
  onOpen,
}: {
  announcement: UserAnnouncement;
  isReadLabel: string;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-start gap-3 rounded-[1.2rem] border border-border border-l-4 p-4 text-left transition-colors hover:bg-secondary/40 ${
        announcement.isRead
          ? "border-l-border bg-background/30"
          : "border-l-accent bg-accent-soft"
      }`}
    >
      <span className="mt-0.5 shrink-0 text-accent">
        <Megaphone size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {formatDate(announcement.publishedAt ?? announcement.createdAt)}
          </span>
          {announcement.isRead ? (
            <span className="text-xs text-muted-foreground/60">
              · {isReadLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-foreground">
          {announcement.title}
        </p>
      </div>
    </button>
  );
}
