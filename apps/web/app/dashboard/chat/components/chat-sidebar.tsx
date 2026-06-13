"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, cn } from "@evcore/ui";
import type { ChatConversation } from "@/domains/chat/types/chat";

export function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ChatConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
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
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-1 rounded-lg transition-colors",
                  conv.id === activeId
                    ? "bg-secondary text-secondary-foreground"
                    : "hover:bg-secondary/60",
                )}
              >
                <button
                  onClick={() => onSelect(conv.id)}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm",
                    conv.id === activeId
                      ? "text-secondary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {conv.title}
                </button>

                {isPersistedConversation(conv.id) ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={cn(
                      "mr-1 shrink-0",
                      conv.id === activeId
                        ? "text-secondary-foreground hover:text-destructive"
                        : "text-muted-foreground hover:text-destructive",
                    )}
                    aria-label={`Supprimer ${conv.title}`}
                    onClick={() => onDelete(conv.id)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function isPersistedConversation(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    id,
  );
}
