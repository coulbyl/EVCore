import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@evcore/ui";
import { MarkdownArticle } from "@/components/markdown-article";
import { CHAT_CONTENT_MAX_WIDTH } from "./chat-constants";
import { PickCard } from "./pick-card";
import type { ChatMessage as ChatMessageType } from "@/domains/chat/types/chat";

// User message — subtle right-aligned block, capped width (Claude pattern).
function UserMessage({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl bg-secondary px-4 py-2.5 text-sm text-secondary-foreground">
        {text}
      </div>
    </div>
  );
}

// EVA message — flat, full-width, no bubble. Text sits on the background.
function EvaMessage({ message }: { message: ChatMessageType }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-accent" />
        EVA
      </div>

      {message.toolLabel ? (
        <div className="flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          {message.toolLabel}…
        </div>
      ) : null}

      <div
        className={cn(
          "flex flex-col gap-2",
          message.error ? "text-destructive" : "text-foreground",
        )}
      >
        {message.text ? (
          <MarkdownArticle content={message.text} variant="chat" />
        ) : null}
        {message.streaming ? (
          <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-foreground" />
        ) : null}
      </div>

      {message.picks && message.picks.length > 0 ? (
        <div className="mt-1 flex flex-col gap-2">
          {message.picks.map((pick, i) => (
            <PickCard key={`${pick.match}-${i}`} pick={pick} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  return (
    <div className={cn("mx-auto w-full", CHAT_CONTENT_MAX_WIDTH)}>
      {message.role === "user" ? (
        <UserMessage text={message.text} />
      ) : (
        <EvaMessage message={message} />
      )}
    </div>
  );
}
