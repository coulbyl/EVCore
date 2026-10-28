/**
 * Minimal mock backend for Playwright viewport tests.
 * Runs on PORT 3099 (override with E2E_MOCK_PORT). Returns session for /auth/me and empty data elsewhere.
 * Started via playwright.config.ts webServer.
 */
import http from "node:http";

const PORT = Number(process.env.E2E_MOCK_PORT ?? 3099);

const SESSION = {
  session: {
    sessionId: "e2e-session",
    user: {
      id: "e2e-user-1",
      email: "e2e@evcore.test",
      username: "e2e_tester",
      fullName: "E2E Tester",
      bio: null,
      // E2E_ROLE=OPERATOR pour voir ce qu'un joueur voit (captures UX).
      role: process.env.E2E_ROLE ?? "ADMIN",
      emailVerified: true,
      avatarUrl: null,
      theme: "system",
      locale: "fr",
      currency: "XOF",
      unitMode: null,
      unitAmount: null,
      unitPercent: null,
      hasCompletedOnboarding: true,
      // Sans ce drapeau la visite guidée (driver.js) démarre à la première
      // visite et pose un voile qui intercepte les clics.
      hasSeenOnboarding: true,
      // E2E_PAUSED=1 : un joueur en pause pour 7 jours (pages de paris
      // remplacées par l'annonce de la pause).
      pausedUntil: process.env.E2E_PAUSED
        ? new Date(Date.now() + 7 * 86_400_000).toISOString()
        : null,
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
    canal: overrides.canal ?? "DOMINANT",
    market: overrides.market ?? "ONE_X_TWO",
    pick: overrides.pick ?? "HOME",
    probability: overrides.probability ?? 0.62,
    marketProbability:
      overrides.marketProbability ??
      Number((1 / overrides.odds / 1.05).toFixed(4)),
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
    playableOdds: overrides.playableOdds ?? null,
    playableBookmaker: overrides.playableOdds ? "1xBet" : null,
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
    // Classe par défaut des jeux de données : le coupon long à cote 2,5–5
    // (le 5–15 n'est plus affiché depuis le 2026-10-18).
    targetOddsMin: overrides.targetOddsMin ?? 2.5,
    targetOddsMax: overrides.targetOddsMax ?? 5,
    couponClass: overrides.couponClass ?? "LONG",
    batch: "evening",
    source: overrides.source ?? "LLM",
    combinedOdds: Number(combinedOdds.toFixed(3)),
    realizedOdds: overrides.realizedOdds ?? null,
    jointProbability: overrides.jointProbability ?? 0.21,
    marketJointProbability: Number(
      legs.reduce((acc, leg) => acc * leg.marketProbability, 1).toFixed(4),
    ),
    signalScore: 0.6,
    status: overrides.status ?? "EXPIRED",
    viewerCount: 0,
    playerCount: 0,
    playedByMe: false,
    followerCount: 0,
    followedByMe: false,
    result: overrides.result ?? null,
    reasoning: null,
    lastFixtureScheduledAt: "2026-10-05T19:00:00.000Z",
    generatedAt: "2026-10-04T18:00:00.000Z",
    legs,
  };
}

const COUPONS = [
  // Le pari sûr du jour : une jambe, favori à domicile, bande 1,10–1,35.
  coupon({
    id: "favourite",
    source: "PRICE_COMPOSER",
    couponClass: "FAVOURITE",
    targetOddsMin: 1.1,
    targetOddsMax: 1.35,
    result: "WON",
    legs: [
      couponLeg({
        id: "fav1",
        odds: 1.22,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "2-0",
        market: "ONE_X_TWO",
        pick: "HOME",
      }),
    ],
  }),
  // Le combiné du jour : deux sélections du moteur, source ENGINE, avec la
  // cote 1xBet à côté de la nôtre.
  coupon({
    id: "combo",
    source: "ENGINE",
    couponClass: "COMBO",
    targetOddsMin: 1.2,
    targetOddsMax: 3.4,
    result: "WON",
    legs: [
      couponLeg({
        id: "cb1",
        odds: 1.22,
        playableOdds: 1.18,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "2-0",
        market: "OVER_UNDER",
        pick: "OVER_1_5",
      }),
      couponLeg({
        id: "cb2",
        odds: 1.25,
        playableOdds: 1.2,
        isCorrect: true,
        settledAt: "2026-10-05T21:00:00.000Z",
        score: "1-1",
        market: "DOUBLE_CHANCE",
        pick: "1X",
      }),
    ],
  }),
  // Chasseur Nul : une sélection, le nul le moins cher de la bande.
  coupon({
    id: "hunter-draw",
    source: "PRICE_COMPOSER",
    couponClass: "HUNTER_DRAW",
    targetOddsMin: 2.9,
    targetOddsMax: 3.6,
    status: "PENDING",
    jointProbability: 0.29,
    legs: [
      couponLeg({
        id: "hd1",
        homeTeam: "Lazio",
        awayTeam: "Torino",
        canal: "PRICE",
        market: "ONE_X_TWO",
        pick: "DRAW",
        odds: 3.3,
      }),
    ],
  }),
  // Le coupon cote 2 : deux jambes prises parmi tout ce qui est coté,
  // classées par la probabilité du marché sans marge (source PRICE_COMPOSER).
  coupon({
    id: "double",
    source: "PRICE_COMPOSER",
    couponClass: "DOUBLE",
    targetOddsMin: 2,
    targetOddsMax: 3,
    status: "PENDING",
    jointProbability: 0.48,
    legs: [
      couponLeg({
        id: "db1",
        homeTeam: "Chelsea",
        awayTeam: "Tottenham",
        canal: "PRICE",
        market: "TEAM_TOTAL_AWAY",
        pick: "UNDER_1_5",
        odds: 1.48,
        playableOdds: 1.53,
        probability: 0.648,
        marketProbability: 0.648,
      }),
      couponLeg({
        id: "db2",
        homeTeam: "Liverpool",
        awayTeam: "Brighton",
        canal: "PRICE",
        market: "OVER_UNDER",
        pick: "UNDER_3_5",
        odds: 1.33,
        playableOdds: 1.36,
        probability: 0.741,
        marketProbability: 0.741,
      }),
    ],
  }),
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

// Sélections du jour (accueil, « Les sélections du jour ») : cinq décisions
// SELECTED sur des canaux fiables, cote 1,20–1,65, coup d'envoi dans quelques
// heures pour que l'ajout au coupon soit proposé. Les dates sont calculées à
// l'exécution : l'accueil ne regarde que la journée courante.
function todayAt(hoursFromNow) {
  return new Date(Date.now() + hoursFromNow * 3_600_000).toISOString();
}

function decision(overrides) {
  return {
    id: `dec-${overrides.id}`,
    fixtureId: `fx-${overrides.id}`,
    fixtureStatus: "SCHEDULED",
    modelRunId: `run-${overrides.id}`,
    competition: overrides.competition ?? "PL",
    competitionName: overrides.competitionName ?? "Premier League",
    country: overrides.country ?? "England",
    homeTeam: overrides.homeTeam,
    awayTeam: overrides.awayTeam,
    homeLogo: null,
    awayLogo: null,
    homeNewCoach: false,
    awayNewCoach: false,
    // Le vrai backend renvoie « HH:MM » (formatTimeUtc), pas un ISO.
    kickoff: todayAt(overrides.hours ?? 4).slice(11, 16),
    scheduledAt: todayAt(overrides.hours ?? 4),
    score: null,
    htScore: null,
    phase: "PREMATCH",
    channel: overrides.channel,
    status: "SELECTED",
    reasonCode: null,
    reasonDetails: null,
    decidedAt: todayAt(-6),
    calibrationAlert: overrides.calibrationAlert ?? false,
    selections: [
      {
        id: `sel-${overrides.id}`,
        market: overrides.market,
        pick: overrides.pick,
        probability: overrides.probability,
        odds: overrides.odds,
        oddsBookmaker: "Bet365",
        marginPaid: 0.05,
        marginBest: 0.03,
        impliedProbability: Number((1 / overrides.odds).toFixed(4)),
        // Probabilité du marché, marge payée retirée (marketProbability).
        marketProbability: Number((1 / overrides.odds / 1.05).toFixed(4)),
        ev: null,
        qualityScore: null,
        rank: 1,
        result: null,
        settledAt: null,
        closingOdds: null,
        closingBookmaker: null,
        closingLineValue: null,
        playableOdds: overrides.playableOdds ?? null,
        playableBookmaker: overrides.playableOdds ? "1xBet" : null,
      },
    ],
  };
}

// Décisions, vue par match : un match à venir avec plusieurs lectures, dont
// deux qui ne peuvent pas passer ensemble (« les deux équipes marquent » et
// « Arsenal n'encaisse pas »), un match « Données suspectes » où Victoire et
// Nul se contredisent, et un match terminé.
function matchGroup({ id, homeTeam, awayTeam, hours, score, picks, ...rest }) {
  const decisions = picks.map((pick, i) => {
    const full = decision({
      id: `${id}-${i}`,
      homeTeam,
      awayTeam,
      hours,
      ...rest,
      ...pick,
    });
    if (pick.result) {
      full.selections[0].result = pick.result;
      full.selections[0].settledAt = todayAt(-1);
    }
    return {
      id: full.id,
      modelRunId: `run-${id}`,
      phase: full.phase,
      channel: full.channel,
      status: pick.status ?? full.status,
      reasonCode: pick.reasonCode ?? null,
      reasonDetails: pick.reasonDetails ?? null,
      decidedAt: full.decidedAt,
      calibrationAlert: rest.calibrationAlert ?? false,
      // Un avis IA « pas de pari » n'a pas de sélection.
      selections: pick.status === "REJECTED" ? [] : full.selections,
    };
  });
  const first = decision({
    id,
    homeTeam,
    awayTeam,
    hours,
    ...rest,
    ...picks[0],
  });
  return {
    fixtureId: `fx-${id}`,
    fixtureStatus: score ? "FINISHED" : "SCHEDULED",
    competition: first.competition,
    competitionName: first.competitionName,
    country: first.country,
    homeTeam,
    awayTeam,
    homeLogo: null,
    awayLogo: null,
    homeNewCoach: false,
    awayNewCoach: false,
    kickoff: first.kickoff,
    scheduledAt: first.scheduledAt,
    score: score ?? null,
    htScore: null,
    selectedCount: decisions.length,
    decisions,
  };
}

// Matchs : trois rencontres telles que le backend les renvoie depuis la fin
// des paris internes (betId toujours null), avec leurs lectures évaluées.
function fixtureRow({
  id,
  fixture,
  hours,
  score = null,
  status = "SCHEDULED",
  picks,
}) {
  return {
    fixtureId: `fx-${id}`,
    fixture,
    homeLogo: null,
    awayLogo: null,
    competition: "Premier League",
    scheduledAt: todayAt(hours),
    status,
    score,
    htScore: null,
    modelRun: {
      modelRunId: `run-${id}`,
      lambdaHome: "1.62",
      lambdaAway: "0.94",
      expectedTotalGoals: "2.56",
      factors: {
        recentForm: 0.64,
        xg: 0.58,
        performanceDomExt: 0.61,
        volatiliteLigue: 0.42,
      },
      evaluatedPicks: picks,
    },
  };
}

const FIXTURE_ROWS = [
  fixtureRow({
    id: "f1",
    fixture: "Arsenal vs Burnley",
    hours: 3,
    picks: [
      {
        market: "ONE_X_TWO",
        pick: "HOME",
        probability: "0.79",
        odds: "1.28",
        ev: "0.011",
        qualityScore: "0.62",
        status: "viable",
      },
      {
        market: "OVER_UNDER",
        pick: "OVER_1_5",
        probability: "0.83",
        odds: "1.22",
        ev: "0.013",
        qualityScore: "0.58",
        status: "viable",
      },
      {
        market: "BTTS",
        pick: "YES",
        probability: "0.55",
        odds: "1.85",
        ev: "0.018",
        qualityScore: "0.31",
        status: "rejected",
        rejectionReason: "ev_below_threshold",
      },
    ],
  }),
  fixtureRow({
    id: "f2",
    fixture: "Ajax vs PSV",
    hours: 5,
    picks: [
      {
        market: "OVER_UNDER",
        pick: "OVER",
        probability: "0.67",
        odds: "1.50",
        ev: "0.005",
        qualityScore: "0.44",
        status: "viable",
      },
    ],
  }),
  fixtureRow({
    id: "f3",
    fixture: "ASEC Mimosas vs Africa Sports",
    hours: -20,
    score: "2-1",
    status: "FINISHED",
    picks: [
      {
        market: "DOUBLE_CHANCE",
        pick: "1X",
        probability: "0.76",
        odds: "1.36",
        ev: "0.034",
        qualityScore: "0.66",
        status: "viable",
      },
    ],
  }),
];

// Mes coupons, Suivi de mise, Notifications : de quoi lire ces pages comme
// un joueur qui a déjà joué (un combiné gagné, un simple perdu, un en cours).
function slipItem({
  id,
  fixture,
  market,
  pick,
  odds,
  stake,
  status,
  score,
  pnl,
}) {
  return {
    betId: `bet-${id}`,
    fixtureId: `fx-${id}`,
    fixture,
    market,
    pick,
    odds,
    ev: "0",
    stake,
    stakeOverride: null,
    createdAt: todayAt(-30),
    betStatus: status,
    homeScore: score ? score[0] : null,
    awayScore: score ? score[1] : null,
    pnl,
    canal: "VALUE",
    homeTeam: fixture.split(" vs ")[0],
    awayTeam: fixture.split(" vs ")[1],
  };
}

/** Résultat en francs tel que le backend le calcule (`slipMoney`). */
function slipResult(result) {
  return {
    status: "PENDING",
    staked: "0.00",
    settledStake: "0.00",
    returned: "0.00",
    net: "0.00",
    pendingStake: "0.00",
    potentialReturn: "0.00",
    ...result,
  };
}

const BET_SLIPS = [
  {
    id: "bs1",
    userId: "u-e2e",
    username: "e2e_tester",
    unitStake: "1000",
    type: "COMBO",
    itemCount: 2,
    createdAt: todayAt(-30),
    items: [
      slipItem({
        id: "b1",
        fixture: "Arsenal vs Burnley",
        market: "ONE_X_TWO",
        pick: "HOME",
        odds: "1.24",
        stake: "1000",
        status: "WON",
        score: [2, 0],
        pnl: "540",
      }),
      slipItem({
        id: "b2",
        fixture: "Ajax vs PSV",
        market: "OVER_UNDER",
        pick: "OVER_1_5",
        odds: "1.24",
        stake: "1000",
        status: "WON",
        score: [3, 1],
        pnl: "540",
      }),
    ],
    totalOdds: "1.54",
    result: slipResult({
      status: "WON",
      staked: "1000.00",
      settledStake: "1000.00",
      returned: "1537.60",
      net: "537.60",
    }),
  },
  {
    id: "bs2",
    userId: "u-e2e",
    username: "e2e_tester",
    unitStake: "1000",
    type: "SIMPLE",
    itemCount: 1,
    createdAt: todayAt(-50),
    items: [
      slipItem({
        id: "b3",
        fixture: "ASEC Mimosas vs Africa Sports",
        market: "DOUBLE_CHANCE",
        pick: "1X",
        odds: "1.32",
        stake: "1000",
        status: "LOST",
        score: [0, 1],
        pnl: "-1000",
      }),
    ],
    totalOdds: null,
    result: slipResult({
      status: "LOST",
      staked: "1000.00",
      settledStake: "1000.00",
      net: "-1000.00",
    }),
  },
  {
    id: "bs3",
    userId: "u-e2e",
    username: "e2e_tester",
    unitStake: "1000",
    type: "SIMPLE",
    itemCount: 1,
    createdAt: todayAt(-2),
    items: [
      slipItem({
        id: "b4",
        fixture: "Bayern München vs FC Augsburg",
        market: "ONE_X_TWO",
        pick: "HOME",
        odds: "1.27",
        stake: "1000",
        status: "PENDING",
        score: null,
        pnl: null,
      }),
    ],
    totalOdds: null,
    // Match pas encore commencé : le serveur le dit supprimable.
    deletable: true,
    result: slipResult({
      staked: "1000.00",
      pendingStake: "1000.00",
      potentialReturn: "1270.00",
    }),
  },
  {
    // Combiné à jambe remboursée : payé à la cote de la jambe gagnée.
    id: "bs4",
    userId: "u-e2e",
    username: "e2e_tester",
    unitStake: "2000",
    type: "COMBO",
    itemCount: 2,
    createdAt: todayAt(-75),
    items: [
      slipItem({
        id: "b5",
        fixture: "Real Madrid vs Getafe",
        market: "ONE_X_TWO",
        pick: "HOME",
        odds: "1.33",
        stake: "2000",
        status: "WON",
        score: [2, 1],
        pnl: "660",
      }),
      slipItem({
        id: "b6",
        fixture: "Lyon vs Nantes",
        market: "DRAW_NO_BET",
        pick: "HOME",
        odds: "1.57",
        stake: "2000",
        status: "VOID",
        score: [1, 1],
        pnl: null,
      }),
    ],
    totalOdds: "2.09",
    result: slipResult({
      status: "WON",
      staked: "2000.00",
      settledStake: "2000.00",
      returned: "2660.00",
      net: "660.00",
    }),
  },
];

const BANKROLL_TRANSACTIONS = [
  [
    "t5",
    "BET_PLACED",
    "-1000",
    ["Bayern München", "FC Augsburg", "HOME"],
    null,
    -2,
  ],
  ["t3", "BET_WON", "1537.60", ["Arsenal", "Burnley", "HOME"], 2, -20],
  ["t2", "BET_PLACED", "-1000", ["Arsenal", "Burnley", "HOME"], 2, -30],
  [
    "t4",
    "BET_PLACED",
    "-1000",
    ["ASEC Mimosas", "Africa Sports", "1X"],
    null,
    -50,
  ],
  ["t1", "DEPOSIT", "50000", null, null, -200],
].map(([id, type, amount, bet, comboLegs, hours]) => ({
  id,
  type,
  amount,
  betId: bet ? `bet-${id}` : null,
  note: null,
  createdAt: todayAt(hours),
  fixture: bet ? `${bet[0]} vs ${bet[1]}` : null,
  homeTeam: bet ? bet[0] : null,
  awayTeam: bet ? bet[1] : null,
  pick: bet ? bet[2] : null,
  comboLegs,
  market: bet ? (bet[2] === "1X" ? "DOUBLE_CHANCE" : "ONE_X_TWO") : null,
}));

// Ce qu'un joueur reçoit en production : des annonces (corps HTML de
// l'éditeur admin, avec l'id de l'annonce) et des réponses du support. Les
// alertes d'ingénierie ne vont qu'aux admins (notification.service.ts).
const ANNOUNCEMENTS = [
  {
    id: "ann-1",
    title: "Nouvelles fiches de formation",
    description:
      "<p>Cinq fiches d&apos;une minute pour <strong>lire nos pronostics</strong>.</p><p>Commence par la première.</p>",
    href: null,
    published: true,
    publishedAt: todayAt(-3),
    expiresAt: null,
    createdAt: todayAt(-3),
    updatedAt: todayAt(-3),
    createdBy: null,
    isRead: false,
  },
];

const PLAYER_NOTIFICATIONS = [
  [
    "n1",
    "ANNOUNCEMENT_PUBLISHED",
    "Nouvelles fiches de formation",
    ANNOUNCEMENTS[0].description,
    -3,
    false,
    { announcementId: "ann-1", href: null },
  ],
  [
    "n5",
    "SLIPS_SETTLED_DIGEST",
    "Tes coupons réglés",
    "2 coupons réglés : 1 gagné, 1 perdu. Misé 2 000 F, rendu 1 540 F : -460 F.",
    -2,
    false,
    { day: "2026-10-27", settled: 2, net: "-460.00" },
  ],
  [
    "n4",
    "SUPPORT_MESSAGE",
    "Réponse de l'équipe",
    "Merci pour ton message, on regarde ça.",
    -26,
    true,
    { conversationId: "conv-1" },
  ],
];

const ADMIN_NOTIFICATIONS = [
  [
    "n2",
    "MARKET_SUSPENSION",
    "Type de pari suspendu",
    "Le pari « Mi-temps / fin de match » est suspendu : il a trop perdu ces 90 derniers jours.",
    -26,
    false,
    null,
  ],
];

const NOTIFICATIONS = [
  ...PLAYER_NOTIFICATIONS,
  ...((process.env.E2E_ROLE ?? "ADMIN") === "ADMIN" ? ADMIN_NOTIFICATIONS : []),
].map(([id, type, title, body, hours, isRead, payload]) => ({
  id,
  type,
  title,
  body,
  payload,
  createdAt: todayAt(hours),
  isRead,
}));

const MATCH_DECISIONS = [
  matchGroup({
    id: "m1",
    homeTeam: "Arsenal",
    awayTeam: "Burnley",
    hours: 3,
    picks: [
      {
        channel: "VANTAGE",
        market: "OVER_UNDER",
        pick: "OVER_1_5",
        probability: 0.8,
        odds: 1.22,
        playableOdds: 1.2,
        reasonCode: "VANTAGE_PLAY",
        reasonDetails: {
          text: "Arsenal marque en moyenne 2,1 buts à domicile sur ses dix derniers matchs et Burnley en encaisse 1,8 à l'extérieur : deux buts dans la rencontre restent le scénario le plus fréquent.",
          basis: "raw_stats",
        },
      },
      {
        channel: "DOMINANT",
        market: "ONE_X_TWO",
        pick: "HOME",
        probability: 0.79,
        odds: 1.28,
        playableOdds: 1.24,
      },
      {
        channel: "GOALS",
        market: "OVER_UNDER",
        pick: "OVER_1_5",
        probability: 0.83,
        odds: 1.22,
        playableOdds: 1.2,
      },
      {
        channel: "TEAM_TOTAL",
        market: "TEAM_TOTAL_HOME",
        pick: "OVER_1_5",
        probability: 0.66,
        odds: 1.55,
        playableOdds: 1.5,
      },
      {
        channel: "BTTS",
        market: "BTTS",
        pick: "YES",
        probability: 0.55,
        odds: 1.85,
        playableOdds: 1.8,
      },
      {
        channel: "CLEAN_SHEET",
        market: "CLEAN_SHEET_HOME",
        pick: "YES",
        probability: 0.48,
        odds: 2.1,
        playableOdds: 2.0,
      },
      {
        channel: "CORRECT_SCORE",
        market: "CORRECT_SCORE",
        pick: "2-0",
        probability: 0.15,
        odds: 7.5,
      },
    ],
  }),
  matchGroup({
    id: "m2",
    homeTeam: "Ajax",
    awayTeam: "PSV",
    competition: "ERD",
    competitionName: "Eredivisie",
    country: "Netherlands",
    hours: 5,
    calibrationAlert: true,
    picks: [
      {
        channel: "VANTAGE",
        market: "ONE_X_TWO",
        pick: "AWAY",
        probability: 0.47,
        odds: 2.3,
        status: "REJECTED",
        reasonCode: "VANTAGE_GATED_ODDS",
        reasonDetails: {
          text: "Lecture retenue mais non proposée : la cote (2.30) dépasse 1.80, au-delà de laquelle nos avis ne tiennent pas leurs promesses. PSV a gagné ses quatre derniers déplacements.",
          gated: { odds: 2.3, pick: "AWAY", market: "ONE_X_TWO" },
        },
      },
      {
        channel: "GOALS",
        market: "OVER_UNDER",
        pick: "OVER",
        probability: 0.67,
        odds: 1.5,
        playableOdds: 1.46,
      },
      {
        channel: "DOMINANT",
        market: "ONE_X_TWO",
        pick: "AWAY",
        probability: 0.47,
        odds: 2.3,
        playableOdds: 2.2,
      },
      {
        channel: "DRAW",
        market: "ONE_X_TWO",
        pick: "DRAW",
        probability: 0.33,
        odds: 3.4,
        playableOdds: 3.3,
      },
    ],
  }),
  matchGroup({
    id: "m3",
    homeTeam: "ASEC Mimosas",
    awayTeam: "Africa Sports",
    competition: "CI1",
    competitionName: "Ligue 1",
    country: "Côte d'Ivoire",
    hours: -20,
    score: "2-1",
    picks: [
      {
        channel: "VANTAGE",
        market: "DOUBLE_CHANCE",
        pick: "1X",
        probability: 0.74,
        odds: 1.36,
        playableOdds: 1.32,
        result: "WON",
        reasonCode: "VANTAGE_PLAY",
        reasonDetails: {
          text: "Nos données internes sont en désaccord : l'une prévoit une victoire de l'ASEC, une autre un match serré. Cette tension rend la double chance intéressante.",
          basis: "tension",
        },
      },
      {
        channel: "DOUBLE_CHANCE",
        market: "DOUBLE_CHANCE",
        pick: "1X",
        probability: 0.76,
        odds: 1.36,
        playableOdds: 1.32,
        result: "WON",
      },
      {
        channel: "BTTS",
        market: "BTTS",
        pick: "YES",
        probability: 0.52,
        odds: 1.9,
        playableOdds: 1.85,
        result: "WON",
      },
    ],
  }),
];

const DECISION_FACETS = {
  leagues: [
    { code: "PL", name: "Premier League", country: "England", count: 1 },
    { code: "ERD", name: "Eredivisie", country: "Netherlands", count: 1 },
    { code: "CI1", name: "Ligue 1", country: "Côte d'Ivoire", count: 1 },
  ],
  channels: [
    { channel: "DOMINANT", count: 2 },
    { channel: "GOALS", count: 2 },
    { channel: "BTTS", count: 2 },
    { channel: "DOUBLE_CHANCE", count: 1 },
    { channel: "DRAW", count: 1 },
  ],
};

const CHANNEL_DECISIONS = [
  {
    channel: "DOMINANT",
    decisions: [
      decision({
        id: "d1",
        channel: "DOMINANT",
        homeTeam: "Arsenal",
        awayTeam: "Burnley",
        market: "ONE_X_TWO",
        pick: "HOME",
        probability: 0.79,
        odds: 1.28,
        playableOdds: 1.24,
        hours: 3,
      }),
      decision({
        id: "d2",
        channel: "DOMINANT",
        homeTeam: "Bayern München",
        awayTeam: "FC Augsburg",
        competition: "BL1",
        competitionName: "Bundesliga",
        country: "Germany",
        market: "ONE_X_TWO",
        pick: "HOME",
        probability: 0.77,
        odds: 1.3,
        playableOdds: 1.27,
        hours: 5,
      }),
    ],
  },
  {
    channel: "GOALS",
    decisions: [
      decision({
        id: "g1",
        channel: "GOALS",
        homeTeam: "Ajax",
        awayTeam: "PSV",
        competition: "ERD",
        competitionName: "Eredivisie",
        country: "Netherlands",
        market: "OVER_UNDER",
        pick: "OVER_1_5",
        probability: 0.82,
        odds: 1.25,
        playableOdds: 1.22,
        hours: 2,
      }),
      decision({
        id: "g2",
        channel: "GOALS",
        homeTeam: "Atalanta",
        awayTeam: "Lecce",
        competition: "SA",
        competitionName: "Serie A",
        country: "Italy",
        market: "OVER_UNDER",
        pick: "OVER_1_5",
        probability: 0.74,
        odds: 1.33,
        playableOdds: 1.3,
        hours: 6,
      }),
    ],
  },
  {
    channel: "DOUBLE_CHANCE",
    decisions: [
      decision({
        id: "c1",
        channel: "DOUBLE_CHANCE",
        homeTeam: "ASEC Mimosas",
        awayTeam: "Africa Sports",
        competition: "CIV1",
        competitionName: "Ligue 1 Côte d'Ivoire",
        country: "Côte d'Ivoire",
        market: "DOUBLE_CHANCE",
        pick: "1X",
        probability: 0.71,
        odds: 1.4,
        playableOdds: 1.36,
        hours: 4,
      }),
      decision({
        id: "c2",
        channel: "DOUBLE_CHANCE",
        homeTeam: "Radnički Niš",
        awayTeam: "Novi Pazar",
        competition: "SRB1",
        competitionName: "Super Liga",
        country: "Serbia",
        market: "DOUBLE_CHANCE",
        pick: "1X",
        probability: 0.69,
        odds: 1.45,
        playableOdds: 1.4,
        hours: 7,
        calibrationAlert: true,
      }),
    ],
  },
];

// Mesures historiques : quatre canaux de la cohorte (dont un sous le seuil de
// 30 réglées) et VALUE, que la page n'affiche plus. Le total d'en-tête égale
// la somme des canaux affichés, comme en production.
const TRACK_RECORD_CHANNELS = [
  {
    channel: "DOUBLE_CHANCE",
    n: 5200,
    announced: 0.78,
    market: 0.752,
    hitRate: 0.77,
    roi: -2.9,
  },
  {
    channel: "DOMINANT",
    n: 3100,
    announced: 0.62,
    market: 0.553,
    hitRate: 0.52,
    roi: -9.4,
  },
  {
    channel: "DRAW",
    n: 1400,
    announced: 0.3,
    market: 0.287,
    hitRate: 0.29,
    roi: -4.8,
  },
  {
    channel: "CORRECT_SCORE",
    n: 20,
    announced: 0.11,
    market: 0.071,
    hitRate: 0.05,
    roi: -41,
  },
  {
    channel: "VALUE",
    n: 900,
    announced: 0.55,
    market: 0.448,
    hitRate: 0.41,
    roi: -11.2,
  },
  // Avis IA : hors total sur Mesures historiques, bilan en tête d'Avis IA.
  {
    channel: "VANTAGE",
    n: 300,
    announced: 0.639,
    market: 0.621,
    hitRate: 0.647,
    roi: -2.3,
  },
];

function calibrationStatus({ n, announced, hitRate }) {
  if (n < 30) return "INSUFFICIENT_DATA";
  const ratio = hitRate / announced;
  if (ratio >= 0.85 && ratio <= 1.15) return "GREEN";
  if (ratio >= 0.7 && ratio <= 1.3) return "ORANGE";
  return "RED";
}

const CHANNEL_STATS = TRACK_RECORD_CHANNELS.map((c) => ({
  channel: c.channel,
  hitRate: c.hitRate,
  announced: c.announced,
  market: c.market,
  avgThreshold: null,
  vsThreshold: null,
  roi: c.roi,
  netUnits: (c.roi * c.n) / 100,
  maxDrawdown: null,
  sampleSize: c.n,
  oddsAvailabilityRate: 1,
  trend: "FLAT",
}));

const CHANNEL_HEALTH = TRACK_RECORD_CHANNELS.map((c) => ({
  channel: c.channel,
  status: calibrationStatus(c),
  primaryMetric: c.hitRate,
  primaryMetricType: "HIT_RATE",
  roi: c.roi,
  hitRate: c.hitRate,
  calibrationRatio: c.hitRate / c.announced,
  vsThreshold: null,
  sampleSize: c.n,
}));

const CHANNEL_COMPETITION_STATS = [
  ["PL", "Premier League", "England", 640, 0.77, 0.762, 0.79],
  ["FR1", "Ligue 1", "France", 410, 0.78, 0.751, 0.74],
  ["CSL", "Chinese Super League", "China", 12, 0.79, 0.73, 0.67],
].map(([code, name, country, n, announced, market, hitRate]) => ({
  channel: code === "PL" ? "DOMINANT" : "DOUBLE_CHANCE",
  competitionCode: code,
  competitionName: name,
  competitionCountry: country,
  roi: -2.1,
  hitRate,
  announced,
  market,
  calibrationRatio: hitRate / announced,
  sampleSize: n,
  status: calibrationStatus({ n, announced, hitRate }),
}));

const TRACK_RECORD_SUMMARY = {
  from: "2026-09-24",
  to: "2026-10-24",
  settled: 9720,
  won: 6855,
  announced: 0.636,
  market: 0.596,
  realised: 0.605,
  returnPerUnit: 0.94,
  sufficient: true,
  byOdds: [
    [null, 1.45, 5600, 0.76, 0.751, 0.769, 0.969],
    [1.45, 1.8, 2100, 0.653, 0.571, 0.594, 0.951],
    [1.8, null, 1700, 0.317, 0.262, 0.258, 0.873],
  ].map(
    ([
      minOdds,
      maxOdds,
      settled,
      announced,
      market,
      realised,
      returnPerUnit,
    ]) => ({
      minOdds,
      maxOdds,
      settled,
      won: Math.round(settled * realised),
      announced,
      market,
      realised,
      returnPerUnit,
      sufficient: true,
      status: calibrationStatus({ n: settled, announced, hitRate: realised }),
    }),
  ),
};

function route(method, url) {
  const path = url.split("?")[0];

  if (method === "OPTIONS") return [200, {}];
  if (path === "/health") return [200, { ok: true }];
  if (path === "/auth/me") return [200, SESSION];
  // Le faux backend ne lit pas les corps : la suppression répond toujours
  // « mot de passe incorrect », ce qui teste la boîte sans perdre la session.
  if (path === "/auth/me/pause")
    return [
      200,
      { pausedUntil: new Date(Date.now() + 7 * 86_400_000).toISOString() },
    ];
  if (path === "/auth/me/delete")
    return [400, { message: "Mot de passe incorrect.", statusCode: 400 }];
  // Changement d'adresse : le code part toujours, la confirmation renvoie
  // une adresse fixe (le faux backend ne lit pas les corps).
  if (path === "/auth/me/email/request") return [200, { status: "ok" }];
  if (path === "/auth/me/email/confirm")
    return [200, { email: "nouvelle@exemple.com" }];
  if (path === "/auth/login") return [200, SESSION, true];
  // Fiche de match : les équipes du match de Décisions, les lectures
  // évaluées de la première rencontre de FIXTURE_ROWS.
  const sheetMatch = path.match(/^\/fixture\/([^/]+)\/sheet$/);
  if (sheetMatch) {
    const group = MATCH_DECISIONS.find((m) => m.fixtureId === sheetMatch[1]);
    if (!group) return [404, { message: "Match introuvable" }];
    const base = FIXTURE_ROWS[0];
    return [
      200,
      {
        ...base,
        fixtureId: group.fixtureId,
        fixture: `${group.homeTeam} vs ${group.awayTeam}`,
        homeTeam: group.homeTeam,
        awayTeam: group.awayTeam,
        competition: group.competitionName,
        country: group.country,
        scheduledAt: group.scheduledAt,
        score: group.score ? group.score.replace("-", " - ") : null,
        modelRun: base.modelRun
          ? {
              ...base.modelRun,
              evaluatedPicks: base.modelRun.evaluatedPicks.map((p) => ({
                ...p,
                marketProbability: Number(
                  (1 / Number(p.odds) / 1.05).toFixed(4),
                ),
              })),
            }
          : null,
      },
    ];
  }
  if (path.startsWith("/fixture"))
    return [
      200,
      { rows: FIXTURE_ROWS, total: FIXTURE_ROWS.length, nextCursor: null },
    ];
  if (path.startsWith("/coupons/track-record")) {
    return [
      200,
      [
        {
          couponClass: "FAVOURITE",
          source: "PRICE_COMPOSER",
          days: 30,
          settled: 24,
          won: 19,
          avgOdds: 1.19,
          returnPerUnit: 0.97,
          firstDay: "2026-09-25",
          lastDay: "2026-10-23",
          worstLosingStreak: 2,
        },
        {
          couponClass: "DOUBLE",
          source: "PRICE_COMPOSER",
          days: 30,
          settled: 0,
          won: 0,
          avgOdds: null,
          returnPerUnit: null,
          firstDay: null,
          lastDay: null,
          worstLosingStreak: 0,
        },
        {
          couponClass: "COMBO",
          source: "ENGINE",
          days: 30,
          settled: 3,
          won: 2,
          avgOdds: 1.4,
          returnPerUnit: 1.02,
          firstDay: "2026-10-20",
          lastDay: "2026-10-23",
          worstLosingStreak: 1,
        },
      ],
    ];
  }
  if (path === "/coupons" && method === "GET") return [200, COUPONS];
  if (path.startsWith("/coupons/") && path.endsWith("/view")) return [204, {}];
  if (path.startsWith("/coupons/") && path.endsWith("/follow"))
    return [204, {}];
  if (path.startsWith("/coupons")) return [200, []];
  if (path.startsWith("/channel-decisions/by-channel"))
    return [200, CHANNEL_DECISIONS];
  if (path.startsWith("/channel-decisions/by-match"))
    return [200, MATCH_DECISIONS];
  if (path.startsWith("/channel-decisions/facets"))
    return [200, DECISION_FACETS];
  if (path.startsWith("/channel-decisions")) return [200, []];
  if (path.startsWith("/dashboard/channel-stats-by-competition"))
    return [200, CHANNEL_COMPETITION_STATS];
  if (path.startsWith("/dashboard/channel-stats")) return [200, CHANNEL_STATS];
  if (path.startsWith("/dashboard/track-record-summary"))
    return [200, TRACK_RECORD_SUMMARY];
  if (path.startsWith("/dashboard/channel-health"))
    return [200, CHANNEL_HEALTH];
  // Accueil opérateur : une liste (pas `{}`) et un résumé « Mes coupons » avec
  // trois coupons joués, pour que le bloc ne soit pas vide sur les captures.
  if (path.startsWith("/dashboard/announcements/unread-count"))
    return [200, { count: ANNOUNCEMENTS.filter((a) => !a.isRead).length }];
  if (path.startsWith("/dashboard/announcements") && method === "GET")
    return [200, ANNOUNCEMENTS];
  if (path.startsWith("/dashboard/announcements")) return [200, {}];
  if (path.startsWith("/bet-slips/summary"))
    return [
      200,
      {
        slipCount: 3,
        wonBets: 2,
        lostBets: 1,
        pendingBets: 1,
        settledBets: 3,
        winRate: "67%",
        // Deux simples gagnés à 1,25 et 1,30, un perdu : −0,45 sur 3.
        plays: {
          won: 2,
          lost: 1,
          void: 0,
          pending: 1,
          settled: 3,
          profitUnits: "-0.45",
          returnRate: "-0.1500",
        },
        money: {
          settledSlips: 3,
          settledStake: "4000.00",
          returned: "4197.60",
          net: "197.60",
          pendingStake: "1000.00",
          firstSlipAt: todayAt(-75),
        },
      },
    ];
  if (path.startsWith("/dashboard/summary")) return [200, EMPTY_DASHBOARD];
  if (path.startsWith("/dashboard/competition-stats")) return [200, []];
  if (path.startsWith("/dashboard/leaderboard")) return [200, []];
  if (path.startsWith("/bankroll/balance"))
    // Un solde à neuf chiffres, comme en production : l'en-tête mobile
    // doit le porter sans déborder.
    return [200, { balance: "500760000.00" }];
  if (path.startsWith("/bankroll/summary"))
    return [
      200,
      {
        balance: "500760000.00",
        deposited: "500000000.00",
        withdrawn: "0.00",
      },
    ];
  if (path.startsWith("/bankroll/transactions"))
    return [200, BANKROLL_TRANSACTIONS];
  if (path.startsWith("/bankroll")) return [200, []];
  if (path === "/bet-slips" && method === "GET") return [200, BET_SLIPS];
  if (path.startsWith("/bet-slips/") && method === "DELETE")
    return [200, { refunded: "1000.00" }];
  if (path.startsWith("/bankroll/withdrawal"))
    return [200, { balance: "500759000.00" }];
  if (path.startsWith("/bet-slips/") && method === "GET") {
    const slip = BET_SLIPS.find((b) => path.endsWith(b.id));
    return slip ? [200, slip] : [404, {}];
  }
  if (path.startsWith("/bet-slips")) return [200, []];
  if (path.startsWith("/audit")) return [200, EMPTY_AUDIT];
  if (path.startsWith("/predictions")) return [200, []];
  if (path.startsWith("/notifications/unread-count"))
    return [200, { count: NOTIFICATIONS.filter((n) => !n.isRead).length }];
  if (path.startsWith("/notifications"))
    return [
      200,
      {
        data: NOTIFICATIONS,
        total: NOTIFICATIONS.length,
        limit: 20,
        offset: 0,
      },
    ];
  if (path.startsWith("/risk")) return [200, {}];
  if (path.startsWith("/adjustment")) return [200, []];
  // Une requête React Query qui reçoit `{}` ou undefined fait planter la
  // page entière (overlay « Query data cannot be undefined ») : tout ce qui
  // est listé ou compté doit recevoir une liste vide.
  if (path.startsWith("/gamification/badges/me")) return [200, { badges: [] }];
  if (path.startsWith("/gamification")) return [200, []];
  // Un objet, pas une liste : les cartes lisent `followedChannels.length`.
  if (path.startsWith("/personalization"))
    return [200, { followedChannels: [], followedLeagues: [] }];
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
