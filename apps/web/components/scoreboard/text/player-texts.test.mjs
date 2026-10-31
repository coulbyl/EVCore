// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { formatPlayerText, pickPlayerTexts } from "./player-texts-constants.ts";

describe("player texts", () => {
  const fr = JSON.parse(
    readFileSync(new URL("../../../messages/fr.json", import.meta.url), "utf8"),
  );
  const texts = pickPlayerTexts(fr);

  it("keeps only the player's namespaces", () => {
    assert.deepEqual(Object.keys(texts), [
      "shell",
      "scoreboard.states",
      "scoreboard.chance",
      "ticket",
      "today.products",
    ]);
    assert.equal(formatPlayerText(texts.shell, "tabs.today"), "Aujourd'hui");
  });

  it("fills a simple placeholder", () => {
    assert.equal(
      formatPlayerText(texts["scoreboard.states"], "offlineSeenAt", {
        time: "18:42",
      }),
      "Hors ligne · vu à 18:42",
    );
  });

  it("never needs the ICU engine: no plural, select or formatted value", () => {
    for (const locale of ["fr", "en"]) {
      const all = JSON.parse(
        readFileSync(
          new URL(`../../../messages/${locale}.json`, import.meta.url),
          "utf8",
        ),
      );
      const raw = JSON.stringify(pickPlayerTexts(all));
      assert.doesNotMatch(raw, /\{\w+\s*,/, locale);
    }
  });
});
