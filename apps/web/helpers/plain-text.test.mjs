// Le texte d'une annonce, lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { plainTextOf } from "./plain-text.ts";

describe("plainTextOf", () => {
  it("keeps paragraphs and line breaks, drops the tags", () => {
    assert.equal(
      plainTextOf(
        "<p>Vous connaissez <strong>EVCore</strong>.</p><h3>⚡ Comment ?</h3><p>📊 les décisions<br>🎯 leur fiabilité</p>",
      ),
      "Vous connaissez EVCore.\n\n⚡ Comment ?\n\n📊 les décisions\n🎯 leur fiabilité",
    );
  });

  it("gives list items a bullet", () => {
    assert.equal(
      plainTextOf(
        "<ul><li>Ce qui vous a plu</li><li>Ce qui a bloqué</li></ul>",
      ),
      "• Ce qui vous a plu\n\n• Ce qui a bloqué",
    );
  });

  it("decodes entities and leaves a script as words", () => {
    assert.equal(
      plainTextOf("<p>1 &lt; 2 &amp; c&#39;est tout</p>"),
      "1 < 2 & c'est tout",
    );
    assert.equal(
      plainTextOf('<p>Lien</p><script>alert("x")</script>'),
      'Lien\n\nalert("x")',
    );
  });

  it("leaves a plain body as it is", () => {
    assert.equal(
      plainTextOf("  Ta matinée : 3 coupons  "),
      "Ta matinée : 3 coupons",
    );
  });
});
