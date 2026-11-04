// La taille du libellé d'un pari sur l'image du ticket (share-image.ts).
// Lancés par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sizeToFit } from "./share-image.ts";

// A text whose width is 0.5 px per character and per pixel of size.
const measureOf = (text) => (size) => text.length * size * 0.5;

describe("sizeToFit", () => {
  it("keeps the size of a label that fits", () => {
    const measure = measureOf("Victoire Arsenal");
    assert.equal(sizeToFit({ measure, width: 820, size: 36, min: 25 }), 36);
  });

  it("makes a long label smaller rather than cut its line", () => {
    // « Wolverhampton Wanderers : moins de 4,5 corners » at 36 px: 828 px.
    const label = "Wolverhampton Wanderers : moins de 4,5 corners";
    const measure = measureOf(label);
    const size = sizeToFit({ measure, width: 820, size: 36, min: 25 });
    assert.equal(size, 35);
    assert.ok(measure(size) <= 820);
  });

  it("never under the floor: the cut is the last resort", () => {
    const measure = measureOf("x".repeat(200));
    assert.equal(sizeToFit({ measure, width: 820, size: 36, min: 25 }), 25);
  });
});
