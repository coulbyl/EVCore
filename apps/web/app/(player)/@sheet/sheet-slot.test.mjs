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

test("every intercepted route is a sheet path, and only those", async () => {
  const { isSheetPath } =
    await import("../../../components/scoreboard/sheet/sheet-constants.ts");
  const intercepted = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/^page(\.dev)?\.tsx$/.test(entry.name)) {
        const route = relative(slot, dir);
        if (route.startsWith("(.)")) intercepted.push(route);
      }
    }
  };
  walk(slot);
  assert.ok(intercepted.length >= 6, "the walk found the intercepted routes");
  for (const route of intercepted) {
    const url = `/${route.slice(3)}`.replace(/\[[^\]]+\]/g, "sample");
    assert.ok(
      isSheetPath(url),
      `${url} opens in a sheet: add it to isSheetPath`,
    );
  }
  for (const page of [
    "/today",
    "/matches",
    "/results",
    "/me",
    "/me/help",
    "/me/account",
    "/matches/sample/analysis",
    "/notifications",
  ]) {
    assert.equal(isSheetPath(page), false, `${page} is a page`);
  }
});
