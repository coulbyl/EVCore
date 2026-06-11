"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Drawer, DrawerContent, DrawerTitle } from "@evcore/ui";
import { Menu, Plus } from "lucide-react";
import { ChatSidebar } from "./chat-sidebar";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessage } from "./chat-message";
import { ChatComposer } from "./chat-composer";
import { MOCK_CONVERSATIONS, mockEvaReply } from "./chat-mock";
import type { ChatConversation, ChatMessage as Msg } from "./chat-types";

export function ChatPageClient() {
  const [conversations, setConversations] =
    useState<ChatConversation[]>(MOCK_CONVERSATIONS);
  const [activeId, setActiveId] = useState<string | null>("c1");
  const [streaming, setStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) ?? null,
    [conversations, activeId],
  );
  const messages = active?.messages ?? [];

  // Keep the latest message in view as the thread grows or streams.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, streaming]);

  function appendToActive(id: string, msg: Msg) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, messages: [...c.messages, msg] } : c,
      ),
    );
  }

  // Static shell: append the user message + a canned EVA reply. Real streaming
  // and tool calls arrive with the Groq backend.
  function handleSend(text: string) {
    let targetId = activeId;
    if (targetId === null) {
      targetId = `c${Date.now()}`;
      const fresh: ChatConversation = {
        id: targetId,
        title: text.slice(0, 40),
        group: "Aujourd'hui",
        messages: [],
      };
      setConversations((prev) => [fresh, ...prev]);
      setActiveId(targetId);
    }
    appendToActive(targetId, {
      id: `u${Date.now()}`,
      role: "user",
      text,
    });
    setStreaming(true);
    window.setTimeout(() => {
      appendToActive(targetId!, mockEvaReply(`e${Date.now()}`));
      setStreaming(false);
    }, 600);
  }

  function selectConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
  }

  function newConversation() {
    setActiveId(null);
    setSidebarOpen(false);
  }

  return (
    <div className="flex h-full gap-4">
      {/* Desktop: persistent left rail. Mobile: hidden (opens as a drawer). */}
      <div className="hidden h-full md:block">
        <ChatSidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={selectConversation}
          onNew={newConversation}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3">
        {/* Mobile-only header with the history toggle + new conversation. */}
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

        {messages.length === 0 ? (
          <ChatEmptyState onPick={handleSend} />
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-2">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}

        <ChatComposer
          streaming={streaming}
          onSend={handleSend}
          onStop={() => setStreaming(false)}
        />
      </div>

      {/* Mobile drawer holding the same sidebar (triggered above). */}
      <Drawer open={sidebarOpen} onOpenChange={setSidebarOpen} direction="left">
        <DrawerContent className="h-full w-72 max-w-[82vw] p-4">
          <DrawerTitle className="sr-only">Conversations</DrawerTitle>
          <ChatSidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={selectConversation}
            onNew={newConversation}
          />
        </DrawerContent>
      </Drawer>
    </div>
  );
}
