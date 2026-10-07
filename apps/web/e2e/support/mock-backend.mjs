/**
 * Minimal mock backend for Playwright viewport tests.
 * Runs on PORT 3099. Returns session for /auth/me and empty data elsewhere.
 * Started via playwright.config.ts webServer.
 */
import http from "node:http";

const PORT = 3099;

const SESSION = {
  session: {
    sessionId: "e2e-session",
    user: {
      id: "e2e-user-1",
      email: "e2e@evcore.test",
      username: "e2e_tester",
      fullName: "E2E Tester",
      bio: null,
      role: "ADMIN",
      emailVerified: true,
      avatarUrl: null,
      theme: "system",
      locale: "fr",
      currency: "XOF",
      unitMode: null,
      unitAmount: null,
      unitPercent: null,
    },
  },
};

const EMPTY_AUDIT = {
  generatedAt: new Date().toISOString(),
  counts: { fixtures: 0, modelRuns: 0, bets: 0 },
  leagueBreakdown: [],
  betsByStatus: [],
  betsByMarket: [],
  settledBets: 0,
  adjustmentProposals: 0,
  activeSuspensions: 0,
};

const EMPTY_DASHBOARD = {
  dashboardKpis: [],
  workerStatuses: [],
  activeAlerts: [],
  pnlSummary: {
    settledBets: 0,
    wonBets: 0,
    winRate: "0%",
    netUnits: "0.0",
    roi: "0.00%",
  },
};

// Coupons du jour : un par issue (gagné, gagné avec jambe remboursée, perdu,
// remboursé) et les deux générateurs, avec la ligne de clôture renseignée sur
// les jambes réglées. Les cotes combinées sont le produit exact des jambes,
// ce que le scénario e2e vérifie à l'écran.
function couponLeg(overrides) {
  return {
    id: overrides.id,
    fixtureId: `fx-${overrides.id}`,
    homeTeam: overrides.homeTeam ?? "Alpha FC",
    homeLogo: null,
    awayTeam: overrides.awayTeam ?? "Beta United",
    awayLogo: null,
    competition: "PL",
    competitionName: "Premier League",
    country: "England",
    scheduledAt: "2026-10-05T19:00:00.000Z",
    score: overrides.score ?? null,
    htScore: null,
    canal: "DOMINANT",
    market: overrides.market ?? "ONE_X_TWO",
    pick: overrides.pick ?? "HOME",
    probability: 0.62,
    oddsSnapshot: overrides.odds,
    bookmaker: overrides.bookmaker ?? null,
    signalScore: 0.62,
    isCorrect: overrides.isCorrect ?? null,
    settledAt: overrides.settledAt ?? null,
    closingOdds: overrides.closingOdds ?? null,
    closingBookmaker: overrides.closingOdds ? "Pinnacle" : null,
    closingObservedAt: overrides.closingOdds
      ? "2026-10-05T18:50:00.000Z"
      : null,
    closingLineValue: overrides.closingLineValue ?? null,
    modelRunId: `run-${overrides.id}`,
  };
}

function coupon(overrides) {
  const legs = overrides.legs;
  const combinedOdds = legs.reduce((acc, leg) => acc * leg.oddsSnapshot, 1);
  return {
    id: overrides.id,
    forDate: "2026-10-05",
    rank: 1,
    signalWindowDays: 0,
    targetOddsMin: 5,
    targetOddsMax: 15,
    couponClass: "UNIQUE",
    batch: "evening",
    source: overrides.source ?? "LLM",
    combinedOdds: Number(combinedOdds.toFixed(3)),
    realizedOdds: overrides.realizedOdds ?? null,
    jointProbability: 0.21,
    signalScore: 0.6,
    status: overrides.status ?? "EXPIRED",
    viewerCount: 0,
    playerCount: 0,
    playedByMe: false,
    result: overrides.result ?? null,
    reasoning: null,
    lastFixtureScheduledAt: "2026-10-05T19:00:00.000Z",
    generatedAt: "2026-10-04T18:00:00.000Z",
    legs,
  };
}

const COUPONS = [
  coupon({
    id: "won",
    result: "WON",
    realizedOdds: 2.1 * 1.9 * 1.5,
    legs: [
      couponLeg({
        id: "w1",
        odds: 2.1,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "2-0",
        closingOdds: 1.9,
        closingLineValue: 0.052,
        bookmaker: "Unibet",
      }),
      couponLeg({
        id: "w2",
        odds: 1.9,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "1-0",
        market: "OVER_UNDER",
        pick: "UNDER",
        closingOdds: 2.0,
        closingLineValue: -0.031,
      }),
      couponLeg({
        id: "w3",
        odds: 1.5,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "3-1",
        market: "BTTS",
        pick: "YES",
      }),
    ],
  }),
  coupon({
    id: "partial",
    result: "PARTIAL",
    // La jambe remboursée (p2) ne compte pas : payé 2.4 × 1.8, pas × 1.6.
    realizedOdds: 2.4 * 1.8,
    legs: [
      couponLeg({
        id: "p1",
        odds: 2.4,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "1-0",
      }),
      couponLeg({
        id: "p2",
        odds: 1.6,
        isCorrect: null,
        settledAt: "2026-10-06T19:00:00.000Z",
        market: "DRAW_NO_BET",
        pick: "HOME",
        score: "1-1",
      }),
      couponLeg({
        id: "p3",
        odds: 1.8,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "0-2",
        pick: "AWAY",
      }),
    ],
  }),
  coupon({
    id: "lost",
    source: "PRICE_COMPOSER",
    result: "LOST",
    legs: [
      couponLeg({
        id: "l1",
        odds: 2.9,
        isCorrect: false,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "0-1",
        closingOdds: 3.1,
        closingLineValue: -0.08,
      }),
      couponLeg({
        id: "l2",
        odds: 2.0,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "2-1",
      }),
    ],
  }),
  coupon({
    id: "void",
    result: "VOID",
    legs: [
      couponLeg({
        id: "v1",
        odds: 2.2,
        isCorrect: null,
        settledAt: "2026-10-06T19:00:00.000Z",
      }),
      couponLeg({
        id: "v2",
        odds: 2.5,
        isCorrect: null,
        settledAt: "2026-10-06T19:00:00.000Z",
      }),
    ],
  }),
];

function route(method, url) {
  const path = url.split("?")[0];

  if (method === "OPTIONS") return [200, {}];
  if (path === "/health") return [200, { ok: true }];
  if (path === "/auth/me") return [200, SESSION];
  if (path === "/auth/login") return [200, SESSION, true];
  if (path.startsWith("/fixture")) return [200, { rows: [], total: 0 }];
  if (path === "/coupons" && method === "GET") return [200, COUPONS];
  if (path.startsWith("/coupons/") && path.endsWith("/view")) return [204, {}];
  if (path.startsWith("/coupons")) return [200, []];
  if (path.startsWith("/dashboard/summary")) return [200, EMPTY_DASHBOARD];
  if (path.startsWith("/dashboard/competition-stats")) return [200, []];
  if (path.startsWith("/dashboard/leaderboard")) return [200, []];
  if (path.startsWith("/bankroll/balance"))
    return [200, { balance: "1000.00" }];
  if (path.startsWith("/bankroll/transactions")) return [200, []];
  if (path.startsWith("/bankroll")) return [200, []];
  if (path.startsWith("/bet-slips")) return [200, []];
  if (path.startsWith("/audit")) return [200, EMPTY_AUDIT];
  if (path.startsWith("/predictions")) return [200, []];
  if (path.startsWith("/notifications")) return [200, { items: [], total: 0 }];
  if (path.startsWith("/risk")) return [200, {}];
  if (path.startsWith("/adjustment")) return [200, []];
  // Une requête React Query qui reçoit `{}` ou undefined fait planter la
  // page entière (overlay « Query data cannot be undefined ») : tout ce qui
  // est listé ou compté doit recevoir une liste vide.
  if (path.startsWith("/gamification")) return [200, []];
  if (path.startsWith("/personalization")) return [200, []];
  if (path.startsWith("/announcements")) return [200, []];

  return [200, {}];
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin ?? "http://localhost:3000";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Cookie, Authorization",
  );
  res.setHeader("Content-Type", "application/json");

  const [status, body, setLoginCookie] = route(req.method, req.url ?? "/");

  if (setLoginCookie) {
    res.setHeader(
      "Set-Cookie",
      "evcore_session=e2e-session; Path=/; SameSite=None; HttpOnly",
    );
  }

  res.statusCode = status;
  res.end(JSON.stringify(body));
});

server.listen(PORT, () => {
  process.stdout.write(`Mock backend ready on :${PORT}\n`);
});
