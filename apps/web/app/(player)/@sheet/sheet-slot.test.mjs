import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// Chaque route du groupe `(player)` doit avoir sa page vide dans la fente
// `@sheet`, sinon la feuille reste ouverte quand on y navigue (no-sheet.tsx).
const slot = dirname(fileURLToPath(import.meta.url));
const group = dirname(slot);

function pagesUnder(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith("@")) walk(path);
      } else if (entry.name === "page.tsx") {
        found.push(relative(root, dir));
      }
    }
  };
  walk(root);
  return found.filter((route) => route !== "");
}

test("every player route empties the sheet slot", () => {
  const routes = pagesUnder(group);
  assert.ok(routes.includes("today"), "the walk found the player routes");
  const slotPages = new Set(pagesUnder(slot));
  const missing = routes.filter((route) => !slotPages.has(route));
  assert.deepEqual(missing, [], `add @sheet/<route>/page.tsx for ${missing}`);
});
