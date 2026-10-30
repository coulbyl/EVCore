// La règle du geste qui referme la feuille (use-drag-to-close.ts).
// Lancés par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCloseGesture } from "./sheet-constants.ts";

describe("isCloseGesture", () => {
  it("referme au-delà de 96 px, même lentement", () => {
    assert.equal(isCloseGesture({ offsetPx: 97, elapsedMs: 2000 }), true);
    assert.equal(isCloseGesture({ offsetPx: 96, elapsedMs: 2000 }), false);
  });

  it("referme sur un geste rapide d'au moins 24 px", () => {
    assert.equal(isCloseGesture({ offsetPx: 30, elapsedMs: 40 }), true);
  });

  it("garde la feuille sur un toucher qui bouge de quelques pixels", () => {
    // 3 px en 4 ms : 0,75 px/ms, au-dessus du seuil de vitesse.
    assert.equal(isCloseGesture({ offsetPx: 3, elapsedMs: 4 }), false);
    assert.equal(isCloseGesture({ offsetPx: 23, elapsedMs: 1 }), false);
  });

  it("garde la feuille sur un glissé lent et court", () => {
    assert.equal(isCloseGesture({ offsetPx: 60, elapsedMs: 500 }), false);
  });

  it("un temps nul ne divise pas par zéro", () => {
    assert.equal(isCloseGesture({ offsetPx: 0, elapsedMs: 0 }), false);
  });
});
