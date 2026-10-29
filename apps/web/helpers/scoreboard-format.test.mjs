// Tests des formats du tableau d'affichage.
// Lancés par `pnpm --filter web test:unit` (lanceur de Node, qui exécute le
// TypeScript importé sans étape de compilation depuis Node 23.6).
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  chanceOf,
  formatOdds,
  formatShare,
  formatShortDate,
  formatTime,
  formatWeekdayDay,
  isValidTimeZone,
  ledsOf,
  roundHalfUp,
} from "./scoreboard-format.ts";

const NBSP = /[\u00a0\u202f]/g;
const plain = (text) => text.replace(NBSP, " ");

describe("roundHalfUp", () => {
  it("rounds half up despite float noise", () => {
    assert.equal(roundHalfUp(0.35 * 10), 4);
    assert.equal(roundHalfUp(0.45 * 10), 5);
    assert.equal(roundHalfUp(2.5), 3);
    assert.equal(roundHalfUp(2.4999), 2);
  });
});

describe("chanceOf", () => {
  it("reads k out of 10 from one half up", () => {
    assert.deepEqual(chanceOf(0.78), { kind: "outOfTen", count: 8, total: 10 });
    assert.deepEqual(chanceOf(0.5), { kind: "outOfTen", count: 5, total: 10 });
    assert.deepEqual(chanceOf(0.65), { kind: "outOfTen", count: 7, total: 10 });
  });

  it("never says 10 out of 10", () => {
    assert.deepEqual(chanceOf(0.97), { kind: "outOfTen", count: 9, total: 10 });
    assert.deepEqual(chanceOf(1), { kind: "outOfTen", count: 9, total: 10 });
  });

  it("reads 1 in N below one half", () => {
    assert.deepEqual(chanceOf(0.45), { kind: "oneIn", total: 2 });
    assert.deepEqual(chanceOf(0.29), { kind: "oneIn", total: 3 });
    assert.deepEqual(chanceOf(1 / 9), { kind: "oneIn", total: 9 });
    assert.deepEqual(chanceOf(0.0094), { kind: "oneIn", total: 106 });
  });

  it("stops at less than 1 in 200", () => {
    assert.deepEqual(chanceOf(1 / 200), { kind: "rarerThan", total: 200 });
    assert.deepEqual(chanceOf(0.0001), { kind: "rarerThan", total: 200 });
    assert.deepEqual(chanceOf(0), { kind: "rarerThan", total: 200 });
  });

  it("agrees with frequencyOf on the screens it already serves", async () => {
    const { frequencyOf } = await import("../lib/frequency.ts");
    for (let step = 1; step <= 100; step += 1) {
      const p = step / 100;
      const old = frequencyOf(p);
      const now = chanceOf(p);
      const total = now.kind === "outOfTen" ? 10 : now.total;
      const count = now.kind === "outOfTen" ? now.count : 1;
      assert.deepEqual({ count, total }, old, `p=${p.toFixed(2)}`);
    }
  });

  it("refuses what is not a probability", () => {
    assert.equal(chanceOf(-0.1), null);
    assert.equal(chanceOf(1.2), null);
    assert.equal(chanceOf(Number.NaN), null);
  });
});

describe("ledsOf", () => {
  it("lights k of 10, or 1 of N up to 20", () => {
    assert.deepEqual(ledsOf(chanceOf(0.78)), { lit: 8, total: 10 });
    assert.deepEqual(ledsOf(chanceOf(1 / 9)), { lit: 1, total: 9 });
    assert.deepEqual(ledsOf(chanceOf(1 / 20)), { lit: 1, total: 20 });
  });

  it("shows the number alone beyond 20", () => {
    assert.equal(ledsOf(chanceOf(1 / 46)), null);
    assert.equal(ledsOf(chanceOf(0.001)), null);
  });
});

describe("formatOdds", () => {
  it("keeps two decimals under 10, one under 100", () => {
    assert.equal(formatOdds(1.28, "fr"), "1,28");
    assert.equal(formatOdds(1.2, "fr"), "1,20");
    assert.equal(formatOdds(10.6, "fr"), "10,6");
    assert.equal(formatOdds(12.444, "fr"), "12,4");
    assert.equal(plain(formatOdds(146.3, "fr")), "146");
    assert.equal(formatOdds(1.28, "en"), "1.28");
  });
});

describe("formatShare", () => {
  it("writes a whole percentage with the French spacing", () => {
    assert.equal(plain(formatShare(0.064, "fr")), "6 %");
    assert.equal(plain(formatShare(0.31, "fr")), "31 %");
    assert.equal(formatShare(0.064, "en"), "6%");
  });
});

describe("dates and times", () => {
  // 29/10/2026 19:00 UTC.
  const kickoff = new Date(Date.UTC(2026, 9, 29, 19, 0));

  it("uses the device time zone, on 24 hours", () => {
    assert.equal(formatTime(kickoff, "fr", "Africa/Abidjan"), "19:00");
    assert.equal(formatTime(kickoff, "fr", "Africa/Douala"), "20:00");
    assert.equal(formatTime(kickoff, "en", "Africa/Abidjan"), "19:00");
  });

  it("writes the short date without the year", () => {
    assert.equal(formatShortDate(kickoff, "fr", "Africa/Abidjan"), "29/10");
  });

  it("writes the weekday and the day", () => {
    assert.equal(formatWeekdayDay(kickoff, "fr", "Africa/Abidjan"), "jeudi 29");
    assert.equal(
      formatWeekdayDay(kickoff, "en", "Africa/Abidjan"),
      "Thursday 29",
    );
  });

  it("crosses midnight with the time zone", () => {
    const late = new Date(Date.UTC(2026, 9, 29, 23, 30));
    assert.equal(formatShortDate(late, "fr", "Africa/Douala"), "30/10");
  });

  it("validates time zones", () => {
    assert.equal(isValidTimeZone("Africa/Abidjan"), true);
    assert.equal(isValidTimeZone("Not/AZone"), false);
    assert.equal(isValidTimeZone(""), false);
    assert.equal(isValidTimeZone(null), false);
  });
});
