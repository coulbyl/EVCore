import type { ReactNode } from "react";

type MarkdownBlock =
  | {
      type: "heading";
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "list";
      items: string[];
    }
  | {
      type: "code";
      language: string;
      code: string;
    }
  | {
      type: "blockquote";
      text: string;
    }
  | {
      type: "hr";
    };

type TocItem = {
  id: string;
  label: string;
};

function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseMarkdown(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i] ?? "";
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    if (!trimmed) {
      i += 1;
      continue;
    }

    if (trimmed === "---") {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (trimmed.startsWith("```")) {
      const language = trimmed.slice(3).trim();
      const codeLines: string[] = [];
      i += 1;

      while (i < lines.length && !(lines[i] ?? "").trim().startsWith("```")) {
        codeLines.push(lines[i] ?? "");
        i += 1;
      }

      if (i < lines.length) i += 1;
      blocks.push({
        type: "code",
        language,
        code: codeLines.join("\n"),
      });
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const hashes = headingMatch[1] ?? "#";
      const text = headingMatch[2]?.trim() ?? "";
      const level = hashes.length as 1 | 2 | 3;
      blocks.push({ type: "heading", level, text });
      i += 1;
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        if (!current.startsWith(">")) break;
        quoteLines.push(current.replace(/^>\s?/, ""));
        i += 1;
      }
      blocks.push({
        type: "blockquote",
        text: quoteLines.join(" "),
      });
      continue;
    }

    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length) {
        const current = (lines[i] ?? "").trim();
        if (!current.startsWith("- ")) break;
        items.push(current.slice(2).trim());
        i += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = (lines[i] ?? "").trim();
      if (
        !current ||
        current === "---" ||
        current.startsWith("```") ||
        current.startsWith(">") ||
        current.startsWith("- ") ||
        /^(#{1,3})\s+/.test(current)
      ) {
        break;
      }
      paragraphLines.push(current);
      i += 1;
    }

    blocks.push({
      type: "paragraph",
      text: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`${match.index}-strong`} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`${match.index}-code`}
          className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[0.92em] text-slate-700"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        const [, label = token, href = "#"] = linkMatch;
        const isAnchor = href.startsWith("#");
        nodes.push(
          <a
            key={`${match.index}-link`}
            href={href}
            className={`font-medium underline underline-offset-4 ${
              isAnchor
                ? "text-cyan-700 decoration-cyan-300 hover:text-cyan-800"
                : "text-slate-700 decoration-slate-300 hover:text-slate-900"
            }`}
          >
            {label}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes;
}

export function getMarkdownToc(content: string): TocItem[] {
  return parseMarkdown(content).flatMap((block) => {
    if (block.type !== "heading" || block.level !== 2) return [];
    return [
      {
        id: slugify(block.text),
        label: block.text,
      },
    ];
  });
}

export function MarkdownArticle({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="space-y-5 text-[14px] leading-7 text-slate-600 sm:space-y-6 sm:text-[15px]">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          const id = slugify(block.text);

          if (block.level === 1) {
            return (
              <header key={`${block.type}-${index}`} className="space-y-3">
                <div className="inline-flex rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  Documentation
                </div>
                <h1
                  id={id}
                  className="scroll-mt-24 text-[1.9rem] font-semibold tracking-tight text-slate-950 sm:text-4xl"
                >
                  {block.text}
                </h1>
              </header>
            );
          }

          if (block.level === 2) {
            return (
              <section
                key={`${block.type}-${index}`}
                className="scroll-mt-24 border-t border-slate-200 pt-6 sm:pt-8"
              >
                <h2
                  id={id}
                  className="text-[1.45rem] font-semibold tracking-tight text-slate-900 sm:text-2xl"
                >
                  {block.text}
                </h2>
              </section>
            );
          }

          return (
            <h3
              key={`${block.type}-${index}`}
              id={id}
              className="scroll-mt-24 text-[1rem] font-semibold tracking-tight text-slate-900 sm:text-lg"
            >
              {block.text}
            </h3>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p
              key={`${block.type}-${index}`}
              className="text-[0.96rem] text-slate-600 sm:text-base"
            >
              {renderInline(block.text)}
            </p>
          );
        }

        if (block.type === "list") {
          return (
            <ul
              key={`${block.type}-${index}`}
              className="space-y-2 pl-5 text-[0.96rem] text-slate-600 sm:text-base"
            >
              {block.items.map((item, itemIndex) => (
                <li key={`${index}-${itemIndex}`} className="list-disc pl-1">
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "code") {
          return (
            <div
              key={`${block.type}-${index}`}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-[0_12px_30px_rgba(15,23,42,0.14)]"
            >
              <div className="border-b border-white/10 px-4 py-2 text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
                {block.language || "texte"}
              </div>
              <pre className="overflow-x-auto px-4 py-4 font-mono text-sm leading-6 text-slate-100">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={`${block.type}-${index}`}
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-[0.96rem] text-amber-900 sm:px-5 sm:text-base"
            >
              {renderInline(block.text)}
            </blockquote>
          );
        }

        return (
          <hr
            key={`${block.type}-${index}`}
            className="border-0 border-t border-slate-200"
          />
        );
      })}
    </div>
  );
}
