// Les anciennes adresses du joueur (11 § 8). Lancé par
// `pnpm --filter web test:unit`.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retiredRouteTarget } from "./retired-routes.ts";

describe("retiredRouteTarget", () => {
  it("sends each retired player address to its new screen", () => {
    const cases = {
      "/dashboard": "/today",
      "/dashboard/coupons": "/today",
      "/dashboard/decisions": "/matches",
      "/dashboard/decisions/match/abc": "/matches",
      "/dashboard/arbitrage": "/results",
      "/dashboard/track-record": "/results",
      "/dashboard/bet-slips": "/me",
      "/dashboard/bankroll": "/me",
      "/dashboard/formation/lire-une-cote": "/me/help",
      "/dashboard/glossaire": "/me/help",
      "/dashboard/inbox/42": "/me/messages",
      "/dashboard/params/account/securite": "/me/account",
      "/dashboard/notifications": "/notifications",
    };
    for (const [from, to] of Object.entries(cases)) {
      assert.equal(retiredRouteTarget(from, "OPERATOR"), to, from);
    }
  });

  it("sends a player on an admin page back to Aujourd'hui", () => {
    assert.equal(retiredRouteTarget("/dashboard/users", "OPERATOR"), "/today");
  });

  it("matches whole segments only", () => {
    assert.equal(
      retiredRouteTarget("/dashboard/couponsx", "OPERATOR"),
      "/today",
    );
    assert.equal(retiredRouteTarget("/dashboards", "OPERATOR"), null);
  });

  it("leaves the admin and the new screens alone", () => {
    assert.equal(retiredRouteTarget("/dashboard/coupons", "ADMIN"), null);
    assert.equal(retiredRouteTarget("/today", "OPERATOR"), null);
  });
});
