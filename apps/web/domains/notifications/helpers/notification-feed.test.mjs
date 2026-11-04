// Lancé par `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  feedHref,
  feedQuery,
  hrefOf,
  newerReading,
  parseFeedFilter,
} from "./notification-feed.ts";
import { adminSectionHref } from "../../../components/scoreboard/shell/shell-constants.ts";

describe("parseFeedFilter", () => {
  it("reads the status and, for an admin, the kind", () => {
    assert.deepEqual(
      parseFeedFilter({ status: "unread", kind: "technical" }, true),
      {
        status: "unread",
        kind: "technical",
      },
    );
  });
  it("a player has no kind; an unknown value is « all »", () => {
    assert.deepEqual(
      parseFeedFilter({ status: "x", kind: "technical" }, false),
      {
        status: "all",
        kind: "all",
      },
    );
  });
});

describe("feedQuery and feedHref", () => {
  it("asks the server for the filter, never filters a page", () => {
    assert.equal(
      feedQuery({ status: "read", kind: "player" }, 30),
      "limit=30&status=read&category=player",
    );
    assert.equal(feedQuery({ status: "all", kind: "all" }, 30), "limit=30");
  });
  it("keeps the filter in the address, « Voir plus » included", () => {
    assert.equal(feedHref({ status: "all", kind: "all" }), "/notifications");
    assert.equal(
      feedHref({ status: "unread", kind: "technical" }, 2),
      "/notifications?status=unread&kind=technical&more=2",
    );
  });
});

describe("hrefOf", () => {
  it("leads a technical alert to its admin screen", () => {
    const technical = (type) => hrefOf(type, adminSectionHref);
    assert.equal(technical("ETL_FAILURE"), "/admin/exploitation");
    assert.equal(technical("XG_UNAVAILABLE_REPORT"), "/admin/exploitation");
    assert.equal(technical("MARKET_SUSPENSION"), "/admin/engine");
    assert.equal(technical("SLIPS_SETTLED_DIGEST"), null);
  });
  it("leads a player's row where it is about; an announcement stays here", () => {
    const player = (type) => hrefOf(type, adminSectionHref);
    assert.equal(player("MORNING_BRIEF"), "/today");
    assert.equal(player("SUPPORT_MESSAGE"), "/me/messages");
    assert.equal(player("ANNOUNCEMENT_PUBLISHED"), null);
  });
});

describe("newerReading", () => {
  it("an answer older than the one shown does not bring back its count", () => {
    const shown = { count: 0, asOf: 2_000 };
    assert.deepEqual(newerReading(shown, { count: 3, asOf: 1_000 }), shown);
    assert.deepEqual(newerReading(shown, { count: 1, asOf: 3_000 }), {
      count: 1,
      asOf: 3_000,
    });
    assert.deepEqual(newerReading(null, { count: 2, asOf: 1 }), {
      count: 2,
      asOf: 1,
    });
  });
});
