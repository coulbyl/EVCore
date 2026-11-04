// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createTranslator } from "next-intl";
import fr from "../messages/fr.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };
import { formatPickWithTeams, formatStatPick } from "./fixture.ts";

const bets = (locale) =>
  createTranslator({
    locale,
    messages: locale === "fr" ? fr : en,
    namespace: "betLabels",
  });
const teams = { home: "Arsenal", away: "Chelsea" };
const label = (bet, locale = "fr") => formatStatPick(bet, teams, bets(locale));
const named = (market, pick, locale = "fr") =>
  formatPickWithTeams({ market, pick }, teams, bets(locale));

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
    "Chelsea obtient plus de 3,5 corners",
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
    "Bukayo Saka tire au moins 1 fois",
  );
  assert.equal(
    label({ market: "PLAYER_SHOTS_ON_TARGET", pick: "P9", line: 2, player }),
    "Bukayo Saka cadre au moins 2 tirs",
  );
});

test("a bet that cannot be read, or another market, gives nothing", () => {
  assert.equal(label({ market: "GOAL_SCORER_ANYTIME", pick: "P9" }), null);
  assert.equal(label({ market: "CORNERS", pick: "OVER", line: null }), null);
  assert.equal(label({ market: "ONE_X_TWO", pick: "HOME" }), null);
});

test("a team's goals read as a sentence, its line as the book prices it", () => {
  assert.equal(
    named("TEAM_TOTAL_HOME", "UNDER_2_5"),
    "Arsenal marque moins de 2,5 buts",
  );
  assert.equal(
    named("TEAM_TOTAL_AWAY", "OVER_1_5"),
    "Chelsea marque plus de 1,5 but",
  );
  assert.equal(named("TEAM_TOTAL_HOME", "OVER_0_5"), "Arsenal marque");
  assert.equal(named("TEAM_TOTAL_AWAY", "UNDER_0_5"), "Chelsea ne marque pas");
  assert.equal(
    named("TEAM_TOTAL_HOME", "UNDER_2_5", "en"),
    "Arsenal score under 2.5 goals",
  );
});

test("the other bets, in French and in English", () => {
  assert.equal(named("ONE_X_TWO", "HOME"), "Victoire Arsenal");
  assert.equal(named("ONE_X_TWO", "HOME", "en"), "Arsenal win");
  assert.equal(named("OVER_UNDER", "UNDER"), "Moins de 2,5 buts");
  assert.equal(named("OVER_UNDER", "OVER_1_5", "en"), "Over 1.5 goals");
  assert.equal(
    named("OVER_UNDER_HT", "UNDER_0_5"),
    "Moins de 0,5 but à la pause",
  );
  assert.equal(named("DOUBLE_CHANCE", "X2", "en"), "Chelsea or draw");
  assert.equal(
    named("RESULT_TOTAL_GOALS", "DRAW_UNDER_2_5"),
    "Match nul et moins de 2,5 buts",
  );
  assert.equal(
    named("HALF_TIME_FULL_TIME", "DRAW_HOME", "en"),
    "level at half-time, Arsenal win at full time",
  );
  assert.equal(named("CORRECT_SCORE", "2:1"), "Arsenal 2–1 Chelsea");
  assert.equal(
    label({ market: "CORNERS_HOME", pick: "UNDER", line: 4.5 }, "en"),
    "Arsenal get under 4.5 corners",
  );
  assert.equal(
    label({ market: "MINUTE_1X2", pick: "DRAW", line: 15 }, "en"),
    "Level after 15 minutes",
  );
  assert.equal(
    label(
      { market: "PLAYER_SHOTS_ON_TARGET", pick: "P9", line: 1, player: "Saka" },
      "en",
    ),
    "Saka has at least 1 shot on target",
  );
});
