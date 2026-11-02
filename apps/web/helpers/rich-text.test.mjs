// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cleanRichHtml, richBlocksOf, safeHref } from "./rich-text.ts";

describe("rich text", () => {
  it("keeps paragraphs, bold, italic, lists and links", () => {
    assert.equal(
      cleanRichHtml(
        '<p>Un <strong>nouveau</strong> <em>pari</em> : <a href="https://evcore.app/today">voir</a></p><ul><li>un</li><li>deux</li></ul>',
      ),
      '<p>Un <strong>nouveau</strong> <em>pari</em> : <a href="https://evcore.app/today">voir</a></p><ul><li>un</li><li>deux</li></ul>',
    );
  });

  it("unwraps other tags and drops scripts whole", () => {
    assert.equal(
      cleanRichHtml(
        '<h2>Titre</h2><div><span style="x">mot</span></div><script>alert(1)</script>',
      ),
      "<p>Titre</p><p>mot</p>",
    );
  });

  it("refuses a javascript: or data: address, keeps the words", () => {
    assert.equal(
      cleanRichHtml('<p><a href="javascript:alert(1)">clic</a></p>'),
      "<p>clic</p>",
    );
    assert.equal(safeHref("data:text/html,x"), null);
    assert.equal(safeHref("/today"), "/today");
    assert.equal(safeHref("//evil.com"), null);
  });

  it("reads plain text with its line breaks; escapes what it writes", () => {
    assert.deepEqual(richBlocksOf("ligne 1\nligne 2"), [
      {
        type: "p",
        children: [
          { type: "text", text: "ligne 1" },
          { type: "br" },
          { type: "text", text: "ligne 2" },
        ],
      },
    ]);
    assert.equal(
      cleanRichHtml("<p>a &lt; b &amp; c</p>"),
      "<p>a &lt; b &amp; c</p>",
    );
    assert.equal(
      cleanRichHtml('<p>x <b>"y"</b></p>'),
      "<p>x <strong>&quot;y&quot;</strong></p>",
    );
  });
});
