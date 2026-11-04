// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { backLabelOf, placeOf } from "./back-places.ts";

const places = {
  back: "Retour",
  screens: {
    "/": "Retour à l'accueil",
    "/today": "Retour à Aujourd'hui",
    "/results": "Retour aux résultats",
    "/me": "Retour à Moi",
    "/me/help": "Retour à l'aide",
  },
};

describe("placeOf", () => {
  it("names a screen, else its closest named parent", () => {
    assert.equal(placeOf("/results", places), "Retour aux résultats");
    assert.equal(placeOf("/results/week", places), "Retour aux résultats");
    assert.equal(placeOf("/me/help/chances", places), "Retour à l'aide");
  });
  it("« / » names itself only; an unknown screen is « Retour »", () => {
    assert.equal(placeOf("/", places), "Retour à l'accueil");
    assert.equal(placeOf("/auth/verify", places), "Retour");
  });
});

describe("backLabelOf", () => {
  it("without history: the parent, by its label or its place", () => {
    const at = { previous: null, places };
    assert.equal(
      backLabelOf({ ...at, href: "/today" }),
      "Retour à Aujourd'hui",
    );
    assert.equal(
      backLabelOf({ ...at, href: "/matches/x", label: "Retour au match" }),
      "Retour au match",
    );
  });
  it("with history: the screen before, the parent's label if it is it", () => {
    assert.equal(
      backLabelOf({ previous: "/results", href: "/today", places }),
      "Retour aux résultats",
    );
    assert.equal(
      backLabelOf({
        previous: "/matches/x",
        href: "/matches/x",
        label: "Retour au match",
        places,
      }),
      "Retour au match",
    );
    assert.equal(
      backLabelOf({
        previous: "/resultats",
        href: "/resultats?period=30",
        places,
      }),
      "Retour",
    );
  });
});
