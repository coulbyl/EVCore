"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@evcore/ui";
import { UserAvatar } from "@/components/user-avatar";
import { useAdminUsers } from "@/domains/admin-users/use-cases/get-admin-users";
import { useStartAdminConversation } from "@/domains/support/use-cases/use-admin-support";

// Lets an admin contact any operator directly, without waiting for them to
// open their own Inbox first — every user should be reachable, not just the
// ones who already happen to have a conversation.
export function NewConversationDialog() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const startConversation = useStartAdminConversation();

  const { data, isLoading } = useAdminUsers({
    q: query || undefined,
    role: "OPERATOR",
    pageSize: 20,
  });

  async function handlePick(userId: string) {
    const conversation = await startConversation.mutateAsync(userId);
    setOpen(false);
    setQuery("");
    router.push(`/dashboard/inbox/${conversation.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Plus size={14} />
        Nouveau message
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Contacter un membre</DialogTitle>
          <DialogDescription>
            Démarre une conversation même si le membre n&apos;a jamais ouvert
            son inbox.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un membre…"
            className="h-10 w-full rounded-xl border border-border bg-panel pl-9 pr-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {isLoading && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Chargement…
            </p>
          )}
          {!isLoading && data?.items.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground">
              Aucun membre trouvé.
            </p>
          )}
          {data?.items.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => void handlePick(user.id)}
              disabled={startConversation.isPending}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-secondary disabled:opacity-50"
            >
              <UserAvatar
                avatarUrl={user.avatarUrl}
                username={user.username}
                size={32}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {user.fullName || user.username}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{user.username}
                </p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
