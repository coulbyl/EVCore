"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BellOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Skeleton,
} from "@evcore/ui";
import { useDashboardAnnouncements } from "@/domains/announcements/use-cases/get-dashboard-announcements";
import { useMarkAnnouncementRead } from "@/domains/announcements/use-cases/mark-announcement-read";
import type { UserAnnouncement } from "@/domains/announcements/types/announcements";
import { RichTextViewer } from "@/components/rich-text-viewer";
import { UpdateRow } from "./update-row";

export function UpdatesPageClient() {
  const t = useTranslations("updates");
  const { data, isLoading } = useDashboardAnnouncements();
  const markRead = useMarkAnnouncementRead();
  const [showUnread, setShowUnread] = useState(false);
  const [selected, setSelected] = useState<UserAnnouncement | null>(null);

  const items = useMemo(() => data ?? [], [data]);
  const unreadCount = items.filter((item) => !item.isRead).length;
  const visible = useMemo(
    () => (showUnread ? items.filter((item) => !item.isRead) : items),
    [items, showUnread],
  );

  function openAnnouncement(announcement: UserAnnouncement) {
    setSelected(announcement);
    if (!announcement.isRead) markRead.mutate(announcement.id);
  }

  return (
    <div className="flex flex-col gap-5">
      <div data-tour="updates-title">
        <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setShowUnread(false)}
          className={`rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${!showUnread ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
        >
          {t("all")}
        </button>
        <button
          type="button"
          onClick={() => setShowUnread(true)}
          className={`flex items-center gap-1.5 rounded-2xl px-4 py-2 text-sm font-medium transition-colors ${showUnread ? "bg-accent/10 text-accent" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
        >
          {t("unread")}
          {unreadCount > 0 ? (
            <span className="inline-flex size-4 items-center justify-center rounded-full bg-destructive text-[0.58rem] font-bold text-destructive-foreground tabular-nums">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-[1.2rem]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
          <span className="inline-flex size-14 items-center justify-center rounded-[1.2rem] border border-border bg-panel-strong">
            <BellOff size={28} className="opacity-40" />
          </span>
          <div className="text-center">
            <p className="font-semibold text-foreground">{t("empty")}</p>
            <p className="mt-1 text-sm">{t("emptyDescription")}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((announcement) => (
            <UpdateRow
              key={announcement.id}
              announcement={announcement}
              isReadLabel={t("isRead")}
              onOpen={() => openAnnouncement(announcement)}
            />
          ))}
        </div>
      )}

      <Dialog
        open={selected !== null}
        onOpenChange={(open) => !open && setSelected(null)}
      >
        <DialogContent
          aria-describedby={undefined}
          className="bg-panel-strong sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selected?.title}
            </DialogTitle>
          </DialogHeader>
          <div className="border-t border-border" />
          <div className="max-h-[55vh] overflow-y-auto">
            {selected ? (
              <RichTextViewer content={selected.description} />
            ) : null}
          </div>
          <div className="border-t border-border" />
          <DialogFooter>
            <Button onClick={() => setSelected(null)}>{t("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
