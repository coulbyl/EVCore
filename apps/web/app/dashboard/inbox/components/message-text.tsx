import { cn } from "@evcore/ui/cn";
import {
  isEmojiOnlyMessage,
  splitMessageText,
} from "./message-content-constants";

// Renders message content with clickable links and, for a message that's
// only a couple of emoji, a larger size — small touches that make the
// thread feel like a real chat app rather than a plain text log.
export function MessageText({ content }: { content: string }) {
  const parts = splitMessageText(content);
  const isEmojiOnly = isEmojiOnlyMessage(content);

  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words",
        isEmojiOnly && "text-3xl leading-normal",
      )}
    >
      {parts.map((part, index) =>
        part.isUrl ? (
          <a
            key={index}
            href={part.text}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:opacity-80"
            onClick={(e) => e.stopPropagation()}
          >
            {part.text}
          </a>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </p>
  );
}
