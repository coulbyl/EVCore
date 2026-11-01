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

  it("leaves the new screens alone", () => {
    assert.equal(retiredRouteTarget("/today", "OPERATOR"), null);
    assert.equal(retiredRouteTarget("/admin", "ADMIN"), null);
  });

  it("moves the admin's inbox and diagnostic sheet, ids kept", () => {
    const cases = {
      "/dashboard/inbox": "/admin/messages",
      "/dashboard/inbox/42": "/admin/messages/42",
      "/dashboard/decisions/match/abc": "/admin/matches/abc",
    };
    for (const [from, to] of Object.entries(cases)) {
      assert.equal(retiredRouteTarget(from, "ADMIN"), to, from);
    }
  });

  it("sends the admin's retired pages to the nearest screen", () => {
    const cases = {
      "/dashboard": "/admin",
      "/dashboard/audit": "/admin/engine",
      "/dashboard/reports": "/admin/engine",
      "/dashboard/documentation-technique/glossaire": "/admin/engine",
      "/dashboard/ml": "/admin/engine",
      "/dashboard/performance": "/admin/engine",
      "/dashboard/users": "/admin/players",
      "/dashboard/announcements": "/admin/players/announce",
      "/dashboard/decisions": "/matches",
      "/dashboard/fixtures": "/matches",
      "/dashboard/coupons": "/today",
      "/dashboard/params/account": "/me/account",
      "/dashboard/updates": "/notifications",
    };
    for (const [from, to] of Object.entries(cases)) {
      assert.equal(retiredRouteTarget(from, "ADMIN"), to, from);
    }
  });
});
