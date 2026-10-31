/**
 * An announcement's body as plain text. The team writes announcements in
 * the admin's rich editor, which stores HTML; the player's bell showed it
 * raw, tags and all (« <p>Vous connaissez…</strong></p> »). Blocks become
 * line breaks, list items keep a bullet, tags go, entities are decoded.
 * Nothing is ever injected into the page: the result is text, so a link or
 * a script slipped into an announcement stays words.
 */
const BLOCK_END = /<\/(p|h[1-6]|li|blockquote|div|ul|ol)>/gi;
const LINE_BREAK = /<br\s*\/?>/gi;
const LIST_ITEM = /<li[^>]*>/gi;
const TAG = /<[^>]*>/g;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
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

export function plainTextOf(html: string): string {
  if (!html.includes("<") && !html.includes("&")) return html.trim();
  const text = html
    .replace(LINE_BREAK, "\n")
    .replace(LIST_ITEM, "• ")
    .replace(BLOCK_END, "\n\n")
    .replace(TAG, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
