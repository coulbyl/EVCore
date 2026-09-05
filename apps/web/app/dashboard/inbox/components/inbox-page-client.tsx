"use client";

import { useEffect } from "react";
import { UserAvatar } from "@/components/user-avatar";
import {
  useMarkSupportRead,
  useOwnConversation,
  useSupportComposer,
  useSupportConnectionStatus,
  useSupportSocket,
  useSupportTyping,
} from "@/domains/support/use-cases/use-support-chat";
import { ChatThread } from "./chat-thread";
import { PushNotificationBanner } from "./push-notification-banner";

export function InboxPageClient() {
  const { data, isLoading } = useOwnConversation();
  const conversationId = data?.conversation.id;
  const composer = useSupportComposer();
  const markRead = useMarkSupportRead();
  const isConnected = useSupportConnectionStatus();
  const { notifyTyping, stopTyping, typingLabel } =
    useSupportTyping(conversationId);
  useSupportSocket(conversationId);

  useEffect(() => {
    markRead.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-border">
        <ChatThread
          conversationId={conversationId}
          messages={data?.messages}
          pendingMessages={composer.pending}
          isLoading={isLoading}
          currentRole="OPERATOR"
          onSend={composer.send}
          onRetryPending={composer.retry}
          onDiscardPending={composer.discard}
          isConnected={isConnected}
          typingLabel={typingLabel}
          onDraftActivity={notifyTyping}
          onDraftIdle={stopTyping}
          otherReadAt={data?.conversation.adminReadAt}
          myReadAt={data?.conversation.userReadAt}
          placeholder="Écrire au gestionnaire…"
          emptyMessage="Écrivez-nous — on répond généralement en quelques heures."
          header={
            <>
              <div
                data-tour="inbox-thread"
                className="flex items-center gap-3 border-b border-border px-4 py-3"
              >
                <UserAvatar
                  avatarUrl={null}
                  username="Équipe EVCore"
                  size={32}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Équipe EVCore
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Répond généralement en quelques heures
                  </p>
                </div>
              </div>
              <PushNotificationBanner />
            </>
          }
        />
      </div>
    </div>
  );
}
