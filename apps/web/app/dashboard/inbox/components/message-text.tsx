import { ExternalLink } from "lucide-react";
import { cn } from "@evcore/ui/cn";
import { LinkPreviewCard } from "@/components/link-preview-card";
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
  // Only the first link gets an unfurl card — same call as RichTextViewer's
  // announcements, but capped at one so a message with several URLs doesn't
  // turn into a wall of cards.
  const firstUrl = parts.find((part) => part.isUrl)?.text;

  return (
    <>
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
              // Decoration alone reads as "link" only once you already know
              // to look for it on a solid-color bubble — the icon makes it
              // unambiguous regardless of bubble variant/contrast. External
              // URLs (the only kind linkified here) never benefit from
              // Next's <Link> prefetch, which only applies to same-app
              // routes — the unfurl card below is what other chat apps
              // actually mean by a link "preview".
              className="font-medium underline decoration-current/50 underline-offset-2 hover:decoration-current"
              onClick={(e) => e.stopPropagation()}
            >
              {part.text}
              <ExternalLink
                size={12}
                className="mb-0.5 ml-0.5 inline-block align-middle opacity-70"
              />
            </a>
          ) : (
            <span key={index}>{part.text}</span>
          ),
        )}
      </p>
      {firstUrl && <LinkPreviewCard url={firstUrl} />}
    </>
  );
}
