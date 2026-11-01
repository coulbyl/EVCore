import type { ReactNode } from "react";
import { richBlocksOf, type RichInline } from "@/helpers/rich-text";

function inline(nodes: RichInline[], linkable: boolean): ReactNode[] {
  return nodes.map((node, index) => {
    switch (node.type) {
      case "text":
        return node.text;
      case "br":
        return <br key={index} />;
      case "strong":
        return (
          <strong key={index} className="font-semibold text-foreground">
            {inline(node.children, linkable)}
          </strong>
        );
      case "em":
        return <em key={index}>{inline(node.children, linkable)}</em>;
      case "a":
        // Inside a row that is already a link, a link would nest: it reads
        // as one, underlined, and the row leads.
        return linkable ? (
          <a
            key={index}
            href={node.href}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {inline(node.children, linkable)}
          </a>
        ) : (
          <span key={index} className="underline underline-offset-4">
            {inline(node.children, linkable)}
          </span>
        );
    }
  });
}

/**
 * An announcement's text, formatted (helpers/rich-text.ts): paragraphs,
 * lists, bold, italic, links — drawn as elements, never injected HTML.
 * The bell, the admin's preview and its list all read it the same way.
 */
export function RichText({
  html,
  linkable = true,
  phrasing = false,
  className,
}: {
  html: string;
  /** False inside a row that is itself a link. */
  linkable?: boolean;
  /** Inside a span (a row of the bell): blocks drawn as spans, bullets as « • ». */
  phrasing?: boolean;
  className?: string;
}) {
  if (phrasing) {
    return (
      <span className={className}>
        {richBlocksOf(html).map((block, index) =>
          block.type === "p" ? (
            <span key={index} className="block [&:not(:first-child)]:mt-1">
              {inline(block.children, linkable)}
            </span>
          ) : (
            <span key={index} className="block">
              {block.items.map((item, i) => (
                <span key={i} className="block">
                  {block.type === "ol" ? `${i + 1}. ` : "• "}
                  {inline(item, linkable)}
                </span>
              ))}
            </span>
          ),
        )}
      </span>
    );
  }
  return (
    <div className={className}>
      {richBlocksOf(html).map((block, index) =>
        block.type === "p" ? (
          <p key={index} className="[&:not(:first-child)]:mt-1.5">
            {inline(block.children, linkable)}
          </p>
        ) : (
          <ul
            key={index}
            className={
              block.type === "ol"
                ? "mt-1.5 list-decimal ps-5"
                : "mt-1.5 list-disc ps-5"
            }
          >
            {block.items.map((item, i) => (
              <li key={i}>{inline(item, linkable)}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}
