"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  cn,
} from "@evcore/ui";
import { useTranslations } from "next-intl";
import { RichTextViewer } from "./rich-text-viewer";
import { useMarkAnnouncementRead } from "@/domains/announcements/use-cases/mark-announcement-read";

type AnnouncementItem = {
  id: string;
  title: string;
  description: string;
  href?: string;
  isRead: boolean;
};

export type { AnnouncementItem };

export function Announcements({
  items,
  className,
}: {
  items: AnnouncementItem[];
  className?: string;
}) {
  const t = useTranslations("dashboard.announcements");
  const router = useRouter();
  const markRead = useMarkAnnouncementRead();
  const [dialogOpen, setDialogOpen] = useState(false);

  const current = useMemo(() => items.find((item) => !item.isRead), [items]);

  function handleMarkAsRead() {
    if (!current) return;
    const href = current.href;
    markRead.mutate(current.id);
    setDialogOpen(false);
    if (href) {
      router.push(href);
    }
  }

  if (!current) return null;

  return (
    <section className={cn("flex flex-col gap-0", className)}>
      <div className="animate-in fade-in slide-in-from-top-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-5 py-3 duration-500">
        <div className="relative shrink-0">
          <Megaphone size={15} className="text-accent" />
          <span className="absolute -right-1 -top-1 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {current.title}
        </span>
        <Button
          size="sm"
          className="shrink-0 rounded-lg bg-accent text-accent-foreground hover:bg-accent/85"
          onClick={() => setDialogOpen(true)}
        >
          {t("read")}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="bg-panel-strong sm:max-w-lg"
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {current.title}
            </DialogTitle>
          </DialogHeader>
          <div className="border-t border-border" />
          <div className="max-h-[55vh] overflow-y-auto">
            <RichTextViewer content={current.description} />
          </div>
          <div className="border-t border-border" />
          <DialogFooter>
            <Button onClick={handleMarkAsRead}>{t("markAsRead")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
