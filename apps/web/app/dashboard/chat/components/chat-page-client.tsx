"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AlertDescription,
  Button,
  Drawer,
  DrawerContent,
  DrawerTitle,
} from "@evcore/ui";
import { Menu, Plus } from "lucide-react";
import { ApiError } from "@/lib/api/shared";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChatSidebar } from "./chat-sidebar";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessage } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { applyStreamEvent } from "./chat-stream-events";
import type {
  ChatConversation,
  ChatMessage as Msg,
} from "@/domains/chat/types/chat";
import {
  createChatConversation,
  deleteChatConversation,
  listChatConversations,
  listChatMessages,
  stopChatGeneration,
  streamChatMessage,
} from "@/domains/chat/use-cases/chat";

function errorText(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

export function ChatPageClient() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<
    string | null
  >(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeStreamConversationRef = useRef<string | null>(null);
  // Conversations whose server history is loaded (or local-only ones that
  // must never be fetched, like error placeholders and fresh conversations).
  const loadedConversationIdsRef = useRef<Set<string>>(new Set());

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const confirmDeleteConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === confirmDeleteId) ??
      null,
    [conversations, confirmDeleteId],
  );
  const messages = active?.messages ?? [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);

  useEffect(() => {
    let cancelled = false;
    listChatConversations()
      .then((items) => {
        if (cancelled) return;
        setConversations(items);
        setActiveId((current) => current ?? items[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        loadedConversationIdsRef.current.add("load-error");
        setConversations([
          {
            id: "load-error",
            title: "EVA indisponible",
            group: "Aujourd'hui",
            messages: [
              {
                id: "load-error-message",
                role: "eva",
                text: errorText(err, "Impossible de charger EVA."),
                error: true,
              },
            ],
          },
        ]);
        setActiveId("load-error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Load the history once per conversation. The result is MERGED with the
  // local messages instead of replacing them: a send started before the
  // history resolves must not be wiped by it.
  useEffect(() => {
    if (!activeId) return;
    if (loadedConversationIdsRef.current.has(activeId)) return;

    let cancelled = false;
    listChatMessages(activeId)
      .then((loadedMessages) => {
        if (cancelled) return;
        loadedConversationIdsRef.current.add(activeId);
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id !== activeId) return c;
            const loadedIds = new Set(loadedMessages.map((m) => m.id));
            const localOnly = c.messages.filter((m) => !loadedIds.has(m.id));
            return { ...c, messages: [...loadedMessages, ...localOnly] };
          }),
        );
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        loadedConversationIdsRef.current.add(activeId);
        appendToConversation(activeId, {
          id: `err-${Date.now()}`,
          role: "eva",
          text: errorText(err, "Impossible de charger cette conversation."),
          error: true,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [activeId]);

  function appendToConversation(id: string, msg: Msg) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, messages: [...c.messages, msg] } : c,
      ),
    );
  }

  function updateMessage(
    conversationId: string,
    messageId: string,
    update: (message: Msg) => Msg,
  ) {
    setConversations((prev) =>
      prev.map((conversation) =>
        conversation.id === conversationId
          ? {
              ...conversation,
              messages: conversation.messages.map((message) =>
                message.id === messageId ? update(message) : message,
              ),
            }
          : conversation,
      ),
    );
  }

  function showLocalErrorConversation(err: unknown) {
    const id = `local-error-${Date.now()}`;
    loadedConversationIdsRef.current.add(id);
    setConversations((prev) => [
      {
        id,
        title: "EVA indisponible",
        group: "Aujourd'hui",
        messages: [
          {
            id: `${id}-message`,
            role: "eva" as const,
            text: errorText(err, "EVA est indisponible."),
            error: true,
          },
        ],
      },
      ...prev,
    ]);
    setActiveId(id);
  }

  async function handleSend(text: string) {
    // Suggestion chips and Enter are not disabled while a stream runs — this
    // guard is what prevents a double send.
    if (streaming) return;
    const userMessageId = `u-${Date.now()}`;
    const assistantMessageId = `eva-${Date.now()}`;
    let targetId: string | null = activeId;
    setStreaming(true);

    try {
      if (targetId === null) {
        const fresh = await createChatConversation(text);
        targetId = fresh.id;
        // Fresh conversation: nothing to fetch, skip the history load.
        loadedConversationIdsRef.current.add(targetId);
        setConversations((prev) => [
          { ...fresh, messages: [] },
          ...prev.filter((c) => c.id !== "load-error"),
        ]);
        setActiveId(targetId);
      }
      const streamId = targetId;

      appendToConversation(streamId, {
        id: userMessageId,
        role: "user",
        text,
      });
      appendToConversation(streamId, {
        id: assistantMessageId,
        role: "eva",
        text: "",
        streaming: true,
      });

      const controller = new AbortController();
      abortRef.current = controller;
      activeStreamConversationRef.current = streamId;
      await streamChatMessage({
        conversationId: streamId,
        content: text,
        signal: controller.signal,
        onEvent: (event) =>
          updateMessage(streamId, assistantMessageId, (message) =>
            applyStreamEvent(message, event),
          ),
      });
    } catch (err: unknown) {
      if (targetId === null) {
        // 422 on conversation creation = quota reached (see ChatService).
        if (err instanceof ApiError && err.status === 422) {
          setNotice(err.message);
          return;
        }
        showLocalErrorConversation(err);
        return;
      }

      if (err instanceof DOMException && err.name === "AbortError") {
        updateMessage(targetId, assistantMessageId, (message) => ({
          ...message,
          text: message.text || "[interrompu]",
          streaming: false,
          toolLabel: undefined,
        }));
        return;
      }

      updateMessage(targetId, assistantMessageId, (message) => ({
        ...message,
        text: errorText(err, "EVA est indisponible."),
        streaming: false,
        toolLabel: undefined,
        error: true,
      }));
    } finally {
      abortRef.current = null;
      activeStreamConversationRef.current = null;
      setStreaming(false);
    }
  }

  async function handleStop() {
    abortRef.current?.abort();
    if (activeStreamConversationRef.current) {
      await stopChatGeneration(activeStreamConversationRef.current).catch(
        () => undefined,
      );
    }
    setStreaming(false);
  }

  function selectConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  function newConversation() {
    abortRef.current?.abort();
    setActiveId(null);
    setSidebarOpen(false);
  }

  function requestDeleteConversation(conversationId: string) {
    setConfirmDeleteId(conversationId);
  }

  async function handleDeleteConversation() {
    if (!confirmDeleteId) return;

    const conversationId = confirmDeleteId;
    setDeletingConversationId(conversationId);
    try {
      if (activeStreamConversationRef.current === conversationId) {
        abortRef.current?.abort();
        await stopChatGeneration(conversationId).catch(() => undefined);
      }

      await deleteChatConversation(conversationId);

      loadedConversationIdsRef.current.delete(conversationId);
      setConversations((prev) => {
        const next = prev.filter(
          (conversation) => conversation.id !== conversationId,
        );
        setActiveId((current) =>
          current === conversationId ? next[0]?.id ?? null : current,
        );
        return next;
      });
      setSidebarOpen(false);
      setNotice(null);
      setConfirmDeleteId(null);
    } catch (err: unknown) {
      setNotice(errorText(err, "Impossible de supprimer cette conversation."));
    } finally {
      setDeletingConversationId(null);
    }
  }

  const displayMessages =
    loading && messages.length === 0
      ? [
          {
            id: "loading",
            role: "eva" as const,
            text: "Chargement des conversations...",
            streaming: true,
          },
        ]
      : messages;

  return (
    <div className="flex h-full gap-4">
      <div className="hidden h-full md:block">
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onNew={newConversation}
          onDelete={requestDeleteConversation}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex items-center justify-between md:hidden">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="size-4" /> Historique
          </Button>
          <Button variant="ghost" size="sm" onClick={newConversation}>
            <Plus className="size-4" />
          </Button>
        </div>

        {displayMessages.length === 0 ? (
          <ChatEmptyState onPick={handleSend} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-2">
            {displayMessages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        {notice && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between gap-3">
              <span>{notice}</span>
              <button className="underline" onClick={() => setNotice(null)}>
                Fermer
              </button>
            </AlertDescription>
          </Alert>
        )}
        <ChatComposer
          streaming={streaming}
          onSend={handleSend}
          onStop={handleStop}
        />
      </div>

      <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
        <DrawerContent className="h-full w-72 max-w-[82vw] p-4">
          <DrawerTitle className="sr-only">Conversations</DrawerTitle>
          <ChatSidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={selectConversation}
            onNew={newConversation}
            onDelete={requestDeleteConversation}
          />
        </DrawerContent>
      </Drawer>
      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null);
        }}
        title="Supprimer la conversation"
        description={
          <>
            La conversation{" "}
            <span className="font-semibold text-foreground">
              {confirmDeleteConversation?.title ?? "EVA"}
            </span>{" "}
            sera définitivement supprimée. Cette action est irréversible.
          </>
        }
        confirmLabel="Supprimer"
        loading={deletingConversationId !== null}
        onConfirm={() => void handleDeleteConversation()}
      />
    </div>
  );
}
