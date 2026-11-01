// The same decoding as plain-text.ts: node's test runner reads one file at
// a time, without resolving an import between them.
const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (whole, code: string) => {
      if (code.startsWith("#x") || code.startsWith("#X")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }
      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    },
  );
}

/**
 * An announcement's text, read as a safe tree (refonte, revue du 01/11):
 * paragraphs, line breaks, lists, bold, italic and links — nothing else.
 * Any other tag is unwrapped (its words stay), a script or a style goes
 * whole, a link keeps only an http(s) or in-app address. The tree is drawn
 * as React elements: no HTML is ever injected into a page. The same tree
 * serialised back is what the admin's editor saves.
 */
export type RichInline =
  | { type: "text"; text: string }
  | { type: "br" }
  | { type: "strong" | "em"; children: RichInline[] }
  | { type: "a"; href: string; children: RichInline[] };

export type RichBlock =
  | { type: "p"; children: RichInline[] }
  | { type: "ul" | "ol"; items: RichInline[][] };

const DROPPED = new Set(["script", "style", "iframe", "object", "embed"]);
const INLINE: Record<string, "strong" | "em"> = {
  strong: "strong",
  b: "strong",
  em: "em",
  i: "em",
};
const BLOCKS = new Set([
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "blockquote",
]);

type Token =
  | { kind: "open"; tag: string; attrs: string }
  | { kind: "close"; tag: string }
  | { kind: "text"; text: string };

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const re = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)([^>]*)>|([^<]+)|(<)/g;
  for (const m of html.matchAll(re)) {
    if (m[4] !== undefined) tokens.push({ kind: "text", text: m[4] });
    else if (m[5] !== undefined) tokens.push({ kind: "text", text: "<" });
    else if (m[1])
      tokens.push({ kind: "close", tag: (m[2] ?? "").toLowerCase() });
    else
      tokens.push({
        kind: "open",
        tag: (m[2] ?? "").toLowerCase(),
        attrs: m[3] ?? "",
      });
  }
  return tokens;
}

/** An http(s) or in-app address; anything else (javascript:, data:) is refused. */
export function safeHref(raw: string): string | null {
  const href = decodeEntities(raw).trim();
  if (/^https?:\/\//i.test(href)) return href;
  if (/^\/(?!\/)/.test(href)) return href;
  return null;
}

function hrefOf(attrs: string): string | null {
  const m = /href\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
  return m ? safeHref(m[2] ?? m[3] ?? m[4] ?? "") : null;
}

/** The safe tree of an announcement's HTML (or plain text). */
export function richBlocksOf(html: string): RichBlock[] {
  const blocks: RichBlock[] = [];
  let paragraph: RichInline[] = [];
  // The inline containers open: their children go to the deepest one.
  const stack: { tag: string; children: RichInline[] }[] = [];
  let list: { type: "ul" | "ol"; items: RichInline[][] } | null = null;
  let item: RichInline[] | null = null;
  let dropping: string | null = null;

  const target = (): RichInline[] =>
    stack.length > 0 ? stack[stack.length - 1]!.children : (item ?? paragraph);
  const push = (node: RichInline) => target().push(node);
  const closeInlines = () => {
    while (stack.length > 0) closeTop();
  };
  const closeTop = () => {
    const top = stack.pop();
    if (!top) return;
    const node: RichInline =
      top.tag === "a"
        ? {
            type: "a",
            href: (top as unknown as { href: string }).href,
            children: top.children,
          }
        : { type: INLINE[top.tag] ?? "strong", children: top.children };
    push(node);
  };
  const flushParagraph = () => {
    closeInlines();
    if (paragraph.some((n) => n.type !== "text" || n.text.trim() !== "")) {
      blocks.push({ type: "p", children: trimInlines(paragraph) });
    }
    paragraph = [];
  };
  const closeList = () => {
    closeInlines();
    if (item && list) list.items.push(trimInlines(item));
    item = null;
    if (list && list.items.length > 0) blocks.push(list);
    list = null;
  };

  for (const token of tokenize(html)) {
    if (dropping) {
      if (token.kind === "close" && token.tag === dropping) dropping = null;
      continue;
    }
    if (token.kind === "text") {
      const text = decodeEntities(token.text);
      if (!list || item) {
        // Plain text keeps its line breaks.
        const lines = text.split("\n");
        lines.forEach((line, index) => {
          if (index > 0) push({ type: "br" });
          if (line) push({ type: "text", text: line });
        });
      }
      continue;
    }
    const { tag } = token;
    if (DROPPED.has(tag)) {
      if (token.kind === "open") dropping = tag;
      continue;
    }
    if (token.kind === "open") {
      if (BLOCKS.has(tag)) flushParagraph();
      else if (tag === "ul" || tag === "ol") {
        flushParagraph();
        closeList();
        list = { type: tag, items: [] };
      } else if (tag === "li") {
        if (!list) {
          flushParagraph();
          list = { type: "ul", items: [] };
        }
        closeInlines();
        if (item) list.items.push(trimInlines(item));
        item = [];
      } else if (tag === "br") push({ type: "br" });
      else if (INLINE[tag]) stack.push({ tag, children: [] });
      else if (tag === "a") {
        const href = hrefOf(token.attrs);
        if (href) stack.push({ tag: "a", children: [], href } as never);
      }
      continue;
    }
    // close
    if (BLOCKS.has(tag)) flushParagraph();
    else if (tag === "ul" || tag === "ol") closeList();
    else if (tag === "li") {
      closeInlines();
      if (item && list) list.items.push(trimInlines(item));
      item = null;
    } else if (INLINE[tag] || tag === "a") {
      const index = stack.map((s) => s.tag).lastIndexOf(tag);
      if (index !== -1) while (stack.length > index) closeTop();
    }
  }
  closeList();
  flushParagraph();
  return blocks;
}

function trimInlines(nodes: RichInline[]): RichInline[] {
  const out = [...nodes];
  while (out[0]?.type === "br") out.shift();
  while (out[out.length - 1]?.type === "br") out.pop();
  return out;
}

const escape = (text: string) =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function inlineHtml(nodes: RichInline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case "text":
          return escape(n.text);
        case "br":
          return "<br>";
        case "a":
          return `<a href="${escape(n.href)}">${inlineHtml(n.children)}</a>`;
        default:
          return `<${n.type}>${inlineHtml(n.children)}</${n.type}>`;
      }
    })
    .join("");
}

/** The tree back to clean HTML: what the admin's editor saves. */
export function richHtmlOf(blocks: RichBlock[]): string {
  return blocks
    .map((b) =>
      b.type === "p"
        ? `<p>${inlineHtml(b.children)}</p>`
        : `<${b.type}>${b.items.map((i) => `<li>${inlineHtml(i)}</li>`).join("")}</${b.type}>`,
    )
    .join("");
}

/** Clean HTML of any HTML: the safe subset only. */
export function cleanRichHtml(html: string): string {
  return richHtmlOf(richBlocksOf(html));
}
