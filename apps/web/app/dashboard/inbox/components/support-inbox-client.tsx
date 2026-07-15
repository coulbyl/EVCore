"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, Skeleton } from "@evcore/ui";
import { cn } from "@evcore/ui/cn";
import { UserAvatar } from "@/components/user-avatar";
import {
  useAdminConversationMessages,
  useAdminConversations,
  useAdminSupportSocket,
  useMarkAdminRead,
  useSendAdminMessage,
} from "@/domains/support/use-cases/use-admin-support";
import type { SupportConversationSummary } from "@/domains/support/types/support";
import { formatRelativeTime } from "@/lib/date";
import { ChatThread } from "./chat-thread";
import { NewConversationDialog } from "./new-conversation-dialog";

function ConversationRow({
  conversation,
  isActive,
  onClick,
}: {
  conversation: SupportConversationSummary;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
        isActive ? "bg-secondary" : "hover:bg-secondary/50",
      )}
    >
      <UserAvatar
        avatarUrl={conversation.avatarUrl}
        username={conversation.username}
        size={36}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-foreground">
            {conversation.fullName || conversation.username}
          </p>
          <span className="shrink-0 text-[0.65rem] text-muted-foreground">
            {formatRelativeTime(conversation.lastMessageAt)}
          </span>
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {conversation.lastMessage?.content ?? "Aucun message"}
        </p>
      </div>
      {conversation.unreadCount > 0 && (
        <Badge variant="accent" className="shrink-0 text-[0.6rem]">
          {conversation.unreadCount}
        </Badge>
      )}
    </button>
  );
}

function ThreadView({
  conversation,
  onBack,
}: {
  conversation: SupportConversationSummary;
  onBack: () => void;
}) {
  const { data: messages, isLoading } = useAdminConversationMessages(
    conversation.id,
  );
  const sendMessage = useSendAdminMessage(conversation.id);
  const markRead = useMarkAdminRead(conversation.id);

  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation.id]);

  return (
    <ChatThread
      messages={messages}
      isLoading={isLoading}
      currentRole="ADMIN"
      onSend={async (content) => {
        await sendMessage.mutateAsync(content);
      }}
      isSending={sendMessage.isPending}
      otherReadAt={conversation.userReadAt}
      placeholder="Répondre…"
      emptyMessage="Aucun message pour l'instant."
      header={
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={onBack}
            className="-ml-1 shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground md:hidden"
          >
            <ArrowLeft size={18} />
          </button>
          <UserAvatar
            avatarUrl={conversation.avatarUrl}
            username={conversation.username}
            size={32}
          />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {conversation.fullName || conversation.username}
            </p>
            <p className="text-xs text-muted-foreground">
              @{conversation.username}
            </p>
          </div>
        </div>
      }
    />
  );
}

// List + detail, backed by real routes (/dashboard/inbox and
// /dashboard/inbox/[conversationId]) rather than local-only state: the
// browser back button, refresh, and deep links to a specific conversation
// all work correctly, and the list/thread panes collapse to a single-pane
// mobile navigation (list ⇄ thread) instead of a cramped two-column squeeze
// — matters once the operator base grows past a handful of accounts.
export function SupportInboxClient({
  activeConversationId,
}: {
  activeConversationId: string | null;
}) {
  const router = useRouter();
  const { data: conversations, isLoading } = useAdminConversations();
  useAdminSupportSocket(activeConversationId);

  const active =
    conversations?.find((c) => c.id === activeConversationId) ?? null;

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden rounded-2xl border border-border md:grid-cols-[320px_1fr]">
        <div
          className={cn(
            "min-w-0 w-full flex-col border-b border-border md:flex md:border-b-0 md:border-r",
            activeConversationId ? "hidden" : "flex",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2.5">
            <p className="text-sm font-semibold text-foreground">
              Conversations
            </p>
            <NewConversationDialog />
          </div>
          <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
            {isLoading &&
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            {!isLoading && conversations?.length === 0 && (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Aucune conversation pour l&apos;instant.
              </p>
            )}
            {conversations?.map((conversation) => (
              <ConversationRow
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === activeConversationId}
                onClick={() =>
                  router.push(`/dashboard/inbox/${conversation.id}`)
                }
              />
            ))}
          </div>
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 w-full",
            activeConversationId ? "flex" : "hidden md:flex",
          )}
        >
          {active ? (
            <ThreadView
              conversation={active}
              onBack={() => router.push("/dashboard/inbox")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm text-muted-foreground">
              Sélectionnez une conversation
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
