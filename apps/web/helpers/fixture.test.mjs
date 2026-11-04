// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { formatStatPick } from "./fixture.ts";

const teams = { home: "Arsenal", away: "Chelsea" };
const label = (bet) => formatStatPick(bet, teams);

test("lines read as the book prices them, never rounded", () => {
  assert.equal(
    label({ market: "CORNERS", pick: "OVER", line: 9.5 }),
    "Plus de 9,5 corners",
  );
  assert.equal(
    label({ market: "CORNERS", pick: "UNDER", line: 10 }),
    "Moins de 10 corners",
  );
  assert.equal(
    label({ market: "CARDS", pick: "UNDER", line: 4.5 }),
    "Moins de 4,5 cartons",
  );
  assert.equal(
    label({ market: "CORNERS_AWAY", pick: "OVER", line: 3.5 }),
    "Chelsea : plus de 3,5 corners",
  );
});

test("corners 1X2 and the minute's 1X2 name the teams", () => {
  assert.equal(
    label({ market: "CORNERS_1X2", pick: "HOME" }),
    "Plus de corners pour Arsenal",
  );
  assert.equal(
    label({ market: "CORNERS_1X2", pick: "DRAW" }),
    "Autant de corners pour les deux équipes",
  );
  assert.equal(
    label({ market: "MINUTE_1X2", pick: "AWAY", line: 30 }),
    "Chelsea mène après 30 minutes",
  );
  assert.equal(
    label({ market: "MINUTE_1X2", pick: "DRAW", line: 15 }),
    "Égalité après 15 minutes",
  );
});

test("scorers and shots name the player", () => {
  const player = "Bukayo Saka";
  assert.equal(
    label({ market: "GOAL_SCORER_ANYTIME", pick: "P9", player }),
    "Bukayo Saka marque",
  );
  assert.equal(
    label({ market: "GOAL_SCORER_FIRST", pick: "P9", player }),
    "Bukayo Saka marque le premier but",
  );
  assert.equal(
    label({ market: "GOAL_SCORER_FIRST", pick: "NONE" }),
    "Aucun buteur",
  );
  assert.equal(
    label({ market: "PLAYER_SHOTS", pick: "P9", line: 1, player }),
    "Bukayo Saka : au moins 1 tir",
  );
  assert.equal(
    label({ market: "PLAYER_SHOTS_ON_TARGET", pick: "P9", line: 2, player }),
    "Bukayo Saka : au moins 2 tirs cadrés",
  );
});

test("a bet that cannot be read, or another market, gives nothing", () => {
  assert.equal(label({ market: "GOAL_SCORER_ANYTIME", pick: "P9" }), null);
  assert.equal(label({ market: "CORNERS", pick: "OVER", line: null }), null);
  assert.equal(label({ market: "ONE_X_TWO", pick: "HOME" }), null);
});
