"use client";

import { Plus } from "lucide-react";
import { Button, cn } from "@evcore/ui";
import type { ChatConversation } from "@/domains/chat/types/chat";

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
}: {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const groups = conversations.reduce<Record<string, ChatConversation[]>>(
    (acc, conv) => {
      (acc[conv.group] ??= []).push(conv);
      return acc;
    },
    {},
  );

  return (
    <aside className="flex h-full w-full flex-col gap-3 md:w-60 md:shrink-0 md:border-r md:border-border md:pr-3">
      <Button variant="secondary" className="justify-start" onClick={onNew}>
        <Plus className="size-4" /> Nouvelle conversation
      </Button>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
        {Object.entries(groups).map(([group, convs]) => (
          <div key={group} className="flex flex-col gap-1">
            <span className="px-2 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
              {group}
            </span>
            {convs.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv.id)}
                className={cn(
                  "truncate rounded-lg px-2 py-1.5 text-left text-sm transition-colors",
                  conv.id === activeId
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-secondary/60",
                )}
              >
                {conv.title}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
