import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "./client";

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 128 * SCRYPT_N * SCRYPT_R * SCRYPT_P * 2; // 64 MB

const COMPETITIONS = [
  {
    leagueId: 39,
    code: "PL",
    name: "Premier League",
    country: "England",
    isActive: true,
    csvDivisionCode: "E0",
  },
  {
    leagueId: 135,
    code: "SA",
    name: "Serie A",
    country: "Italy",
    isActive: true,
    csvDivisionCode: "I1",
  },
  {
    leagueId: 140,
    code: "LL",
    name: "La Liga",
    country: "Spain",
    isActive: true,
    csvDivisionCode: "SP1",
  },
  {
    leagueId: 78,
    code: "BL1",
    name: "Bundesliga",
    country: "Germany",
    isActive: true,
    csvDivisionCode: "D1",
  },
  {
    leagueId: 61,
    code: "L1",
    name: "Ligue 1",
    country: "France",
    isActive: true,
    csvDivisionCode: "F1",
  },
  {
    leagueId: 40,
    code: "CH",
    name: "Championship",
    country: "England",
    isActive: true,
    csvDivisionCode: "E1",
  },
  {
    leagueId: 136,
    code: "I2",
    name: "Serie B",
    country: "Italy",
    isActive: true,
    csvDivisionCode: "I2",
  },
  {
    leagueId: 141,
    code: "SP2",
    name: "Segunda Division",
    country: "Spain",
    isActive: true,
    csvDivisionCode: "SP2",
  },
  {
    leagueId: 79,
    code: "D2",
    name: "2. Bundesliga",
    country: "Germany",
    isActive: true,
    csvDivisionCode: "D2",
  },
  {
    leagueId: 62,
    code: "F2",
    name: "Ligue 2",
    country: "France",
    isActive: true,
    csvDivisionCode: "F2",
  },
  {
    leagueId: 41,
    code: "EL1",
    name: "League One",
    country: "England",
    isActive: true,
    csvDivisionCode: "E2",
  },
  {
    leagueId: 42,
    code: "EL2",
    name: "League Two",
    country: "England",
    isActive: true,
    csvDivisionCode: "E3",
  },
  {
    leagueId: 88,
    code: "ERD",
    name: "Eredivisie",
    country: "Netherlands",
    isActive: true,
    csvDivisionCode: "N1",
  },
  {
    leagueId: 94,
    code: "POR",
    name: "Primeira Liga",
    country: "Portugal",
    isActive: true,
    csvDivisionCode: "P1",
  },
  {
    leagueId: 98,
    code: "J1",
    name: "J1 League",
    country: "Japan",
    isActive: true,
    csvDivisionCode: "JPN",
    seasonStartMonth: 1,
  },
  {
    leagueId: 262,
    code: "MX1",
    name: "Liga MX",
    country: "Mexico",
    isActive: false,
    csvDivisionCode: "MEX",
    seasonStartMonth: 6,
  },
  {
    leagueId: 2,
    code: "UCL",
    name: "UEFA Champions League",
    country: "Europe",
    isActive: true,
    includeInBacktest: true,
    csvDivisionCode: null,
  },
  {
    leagueId: 3,
    code: "UEL",
    name: "UEFA Europa League",
    country: "Europe",
    isActive: true,
    includeInBacktest: true,
    csvDivisionCode: null,
  },
  {
    leagueId: 848,
    code: "UECL",
    name: "UEFA Europa Conference League",
    country: "Europe",
    isActive: true,
    includeInBacktest: true,
    csvDivisionCode: null,
  },
  // International competitions — apiSeasonOverride bypasses the standard
  // seasonStartMonth logic (API Football uses non-calendar season numbering
  // for international tournaments).
  {
    leagueId: 32,
    code: "WCQE",
    name: "World Cup Qualification - Europe",
    country: "World",
    isActive: true,
    includeInBacktest: false,
    csvDivisionCode: null,
    apiSeasonOverride: 2024,
  },
  // --- New leagues (Groupe A — backtest possible) ---
  {
    leagueId: 106,
    code: "POL1",
    name: "Ekstraklasa",
    country: "Poland",
    isActive: false,
    csvDivisionCode: "POL",
  },
  {
    leagueId: 207,
    code: "SUI1",
    name: "Super League",
    country: "Switzerland",
    isActive: false,
    csvDivisionCode: "SWZ",
  },
  {
    leagueId: 203,
    code: "TUR1",
    name: "Süper Lig",
    country: "Turkey",
    isActive: false,
    csvDivisionCode: "T1",
  },
  {
    leagueId: 113,
    code: "SWE1",
    name: "Allsvenskan",
    country: "Sweden",
    isActive: false,
    csvDivisionCode: "SWE",
    seasonStartMonth: 2,
  },
  {
    leagueId: 114,
    code: "SWE2",
    name: "Superettan",
    country: "Sweden",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 2,
  },
  {
    leagueId: 253,
    code: "MLS",
    name: "Major League Soccer",
    country: "USA",
    isActive: false,
    csvDivisionCode: "USA",
    seasonStartMonth: 2,
  },
  {
    leagueId: 103,
    code: "NOR1",
    name: "Eliteserien",
    country: "Norway",
    isActive: false,
    csvDivisionCode: "NOR",
    seasonStartMonth: 2,
  },
  // --- New leagues (Groupe B — pas de backtest, ne pas activer sans source historique) ---
  {
    leagueId: 107,
    code: "POL2",
    name: "I Liga",
    country: "Poland",
    isActive: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 345,
    code: "CZE1",
    name: "Czech Liga",
    country: "Czech Republic",
    isActive: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 208,
    code: "SUI2",
    name: "Challenge League",
    country: "Switzerland",
    isActive: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 204,
    code: "TUR2",
    name: "1. Lig",
    country: "Turkey",
    isActive: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 286,
    code: "SRB1",
    name: "Super Liga",
    country: "Serbia",
    isActive: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 373,
    code: "SVN1",
    name: "1. SNL",
    country: "Slovenia",
    isActive: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 104,
    code: "NOR2",
    name: "1. Division",
    country: "Norway",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 2,
  },
  // --- Leagues Asie / Amériques / Nordiques ---
  {
    leagueId: 71,
    code: "BRA1",
    name: "Brasileirão Série A",
    country: "Brazil",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 3,
    includeInBacktest: true, // odds historiques via The Odds API (soccer_brazil_campeonato)
  },
  {
    leagueId: 292,
    code: "KOR1",
    name: "K League 1",
    country: "South-Korea",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 1,
    includeInBacktest: false, // pas de source odds historiques
  },
  {
    leagueId: 169,
    code: "CSL",
    name: "Super League",
    country: "China",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 2,
    includeInBacktest: true, // odds historiques via The Odds API (soccer_china_superleague)
  },
  {
    leagueId: 244,
    code: "FIN1",
    name: "Veikkausliiga",
    country: "Finland",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 3,
    includeInBacktest: true, // odds historiques via The Odds API (soccer_finland_veikkausliiga)
  },
  {
    leagueId: 164,
    code: "ISL1",
    name: "Úrvalsdeild",
    country: "Iceland",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 3,
    includeInBacktest: false,
  },
  {
    leagueId: 329,
    code: "EST1",
    name: "Meistriliiga",
    country: "Estonia",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 2,
    includeInBacktest: false,
  },
  {
    leagueId: 365,
    code: "LAT1",
    name: "Virsliga",
    country: "Latvia",
    isActive: false,
    csvDivisionCode: null,
    seasonStartMonth: 2,
    includeInBacktest: false,
  },
  {
    leagueId: 10,
    code: "FRI",
    name: "International Friendlies",
    country: "World",
    isActive: false,
    includeInBacktest: false,
    csvDivisionCode: null,
    apiSeasonOverride: 2026,
  },
  {
    leagueId: 5,
    code: "UNL",
    name: "UEFA Nations League",
    country: "World",
    isActive: true,
    includeInBacktest: false,
    csvDivisionCode: null,
    apiSeasonOverride: 2024,
  },
  {
    leagueId: 1,
    code: "WC",
    name: "FIFA World Cup",
    country: "World",
    isActive: true, // activer manuellement à J-7 du tournoi (11 juin 2026)
    includeInBacktest: true, // saison 2022 disponible pour calibration Brier
    csvDivisionCode: null,
    apiSeasonOverride: 2026,
  },
  // --- WCQ confederation qualifiers — cross-comp stats source for national team fixtures ---
  // isActive=true so routine ETL syncs pick them up automatically.
  // No csvDivisionCode / no The Odds API key — stats only, no EV backtest.
  {
    leagueId: 31,
    code: "WCQCA",
    name: "World Cup Qualification - CONCACAF",
    country: "World",
    isActive: true,
    includeInBacktest: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 34,
    code: "WCQSA",
    name: "World Cup Qualification - South America",
    country: "World",
    isActive: true,
    includeInBacktest: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 30,
    code: "WCQAS",
    name: "World Cup Qualification - Asia",
    country: "World",
    isActive: true,
    includeInBacktest: false,
    csvDivisionCode: null,
  },
  {
    leagueId: 29,
    code: "WCQAF",
    name: "World Cup Qualification - Africa",
    country: "World",
    isActive: true,
    includeInBacktest: false,
    csvDivisionCode: null,
    apiSeasonOverride: 2023, // Africa WCQ cycle ended in 2023
  },
  {
    leagueId: 33,
    code: "WCQOC",
    name: "World Cup Qualification - Oceania",
    country: "World",
    isActive: true,
    includeInBacktest: false,
    csvDivisionCode: null,
  },
];

async function seedCompetitions() {
  for (const competition of COMPETITIONS) {
    await prisma.competition.upsert({
      where: { leagueId: competition.leagueId },
      update: {
        // isActive intentionally excluded — managed via UI/migrations, not seed
        includeInBacktest: competition.includeInBacktest ?? true,
        csvDivisionCode: competition.csvDivisionCode,
        apiSeasonOverride: competition.apiSeasonOverride,
      },
      create: competition,
    });
  }

  console.log(`[db:seed] competitions upserted: ${COMPETITIONS.length}`);
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }).toString("hex");
  return `${SCRYPT_N}:${SCRYPT_R}:${SCRYPT_P}:${salt}:${hash}`;
}

async function seedAdminUser() {
  const email = normalizeIdentifier(
    process.env.SEED_ADMIN_EMAIL ?? "admin@evcore.local",
  );
  const username = normalizeIdentifier(
    process.env.SEED_ADMIN_USERNAME ?? "admin",
  );
  const fullName = (process.env.SEED_ADMIN_FULL_NAME ?? "EVCore Admin").trim();
  const password = process.env.SEED_ADMIN_PASSWORD;

  const matchingUsers = await prisma.user.findMany({
    where: { OR: [{ email }, { username }] },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
    },
  });

  if (matchingUsers.length > 1) {
    throw new Error(
      `[db:seed] admin seed is ambiguous for email=${email} username=${username}`,
    );
  }

  if (matchingUsers.length === 1) {
    const user = matchingUsers[0];

    if (!user) {
      throw new Error("[db:seed] unexpected missing admin candidate");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        email,
        username,
        fullName,
        role: "ADMIN",
        emailVerified: true,
        ...(password && password.trim() !== ""
          ? { passwordHash: hashPassword(password) }
          : {}),
      },
    });

    console.log(`[db:seed] admin user ensured: ${email}`);
    return;
  }

  if (!password || password.trim() === "") {
    console.log(
      "[db:seed] admin user skipped: set SEED_ADMIN_PASSWORD to create it",
    );
    return;
  }

  await prisma.user.create({
    data: {
      email,
      username,
      fullName,
      passwordHash: hashPassword(password),
      role: "ADMIN",
      emailVerified: true,
    },
    select: { id: true },
  });

  console.log(`[db:seed] admin user created: ${email}`);
}

const BADGES = [
  {
    code: "vol_50",
    name: "Vétéran",
    description: "50 paris réglés — seuil de significativité statistique.",
  },
  {
    code: "vol_150",
    name: "Expert",
    description: "150 paris réglés — base solide pour la calibration.",
  },
  {
    code: "vol_300",
    name: "Maître",
    description:
      "300 paris réglés — données suffisantes pour le modèle long terme.",
  },
  {
    code: "streak_5",
    name: "En feu",
    description: "5 prédictions Canal Confiance correctes consécutives.",
  },
  {
    code: "patience",
    name: "Patience",
    description: "Traverser un drawdown ≥ 10 % sans override manuel.",
  },
  {
    code: "calibre",
    name: "Calibré",
    description: "Brier Score < 0,20 sur 50+ prédictions.",
  },
  {
    code: "graduate",
    name: "Diplômé",
    description: "Tous les contenus de base de la formation sont terminés.",
  },
] as const;

async function seedBadges() {
  for (const badge of BADGES) {
    await prisma.badge.upsert({
      where: { code: badge.code },
      update: { name: badge.name, description: badge.description },
      create: badge,
    });
  }
  console.log(`[db:seed] badges upserted: ${BADGES.length}`);
}

async function main() {
  await seedCompetitions();
  await seedAdminUser();
  await seedBadges();
}

main()
  .catch((error) => {
    console.error("[db:seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
