"use client";

import { clientApiRequest } from "@/lib/api/client-api";
import { BACKEND_URL, parseApiError } from "@/lib/api/shared";
import type {
  ChatConversation,
  ChatConversationDto,
  ChatMessage,
  ChatMessageDto,
  ChatStreamEvent,
} from "../types/chat";

function groupFor(dateIso: string): string {
  const date = new Date(dateIso);
  const today = new Date();
  const startToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const startDate = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const diffDays = Math.round(
    (startToday.getTime() - startDate.getTime()) / 86400000,
  );

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  return "Plus ancien";
}

function toConversation(conversation: ChatConversationDto): ChatConversation {
  return {
    id: conversation.id,
    title: conversation.title || "Conversation EVA",
    group: groupFor(conversation.updatedAt),
    messages: [],
  };
}

function toMessage(message: ChatMessageDto): ChatMessage | null {
  if (message.role === "tool") return null;
  return {
    id: message.id,
    role: message.role === "assistant" ? "eva" : "user",
    text: message.content,
    ...(message.picks && message.picks.length > 0
      ? { picks: message.picks }
      : {}),
  };
}

export async function listChatConversations(): Promise<ChatConversation[]> {
  const conversations = await clientApiRequest<ChatConversationDto[]>(
    "/chat/conversations",
    { fallbackErrorMessage: "Impossible de charger les conversations EVA." },
  );
  return conversations.map(toConversation);
}

export async function createChatConversation(
  content: string,
): Promise<ChatConversation> {
  const conversation = await clientApiRequest<ChatConversationDto>(
    "/chat/conversations",
    {
      method: "POST",
      body: { content },
      fallbackErrorMessage: "Impossible de créer la conversation EVA.",
    },
  );
  return toConversation(conversation);
}

export async function listChatMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const messages = await clientApiRequest<ChatMessageDto[]>(
    `/chat/conversations/${conversationId}/messages`,
    { fallbackErrorMessage: "Impossible de charger les messages EVA." },
  );
  return messages.map(toMessage).filter((message) => message !== null);
}

export async function stopChatGeneration(
  conversationId: string,
): Promise<void> {
  await clientApiRequest<void>(`/chat/conversations/${conversationId}/stop`, {
    method: "POST",
    fallbackErrorMessage: "Impossible d'arrêter la génération EVA.",
  });
}

export async function streamChatMessage(input: {
  conversationId: string;
  content: string;
  signal: AbortSignal;
  onEvent: (event: ChatStreamEvent) => void;
}): Promise<void> {
  const response = await fetch(
    `${BACKEND_URL}/chat/conversations/${input.conversationId}/messages`,
    {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: input.content }),
      signal: input.signal,
    },
  );

  if (!response.ok || !response.body) {
    throw await parseApiError(
      response,
      `EVA n'a pas pu répondre (${response.status}).`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = parseSseEvent(part);
      if (event) input.onEvent(event);
    }
  }

  if (buffer.trim()) {
    const event = parseSseEvent(buffer);
    if (event) input.onEvent(event);
  }
}

function parseSseEvent(chunk: string): ChatStreamEvent | null {
  let name = "";
  let data = "";

  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) {
      name = line.slice("event:".length).trim();
    }
    if (line.startsWith("data:")) {
      data += line.slice("data:".length).trim();
    }
  }

  if (!name || !data) return null;

  try {
    return {
      event: name,
      data: JSON.parse(data) as unknown,
    } as ChatStreamEvent;
  } catch {
    return null;
  }
}
