// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { searchKey } from "./search-key.ts";

// The search box repeats searchKey inline (its module weighed on the JS
// budget): the two must keep the same steps.
test("the search box normalises the query as the rows' keys", () => {
  const box = readFileSync(
    new URL("./search-box.tsx", import.meta.url),
    "utf8",
  );
  const inline = box.match(/const key = query([\s\S]*?);/)?.[1];
  assert.ok(inline, "the search box still normalises the query inline");
  const steps = (code) => code.replace(/\s+/g, "");
  const shared = readFileSync(
    new URL("./search-key.ts", import.meta.url),
    "utf8",
  ).match(/return text([\s\S]*?);/)?.[1];
  assert.equal(steps(inline), steps(shared));
  assert.equal(searchKey("  Köln "), "koln");
});
