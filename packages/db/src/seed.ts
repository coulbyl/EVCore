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
];

async function seedCompetitions() {
  for (const competition of COMPETITIONS) {
    await prisma.competition.upsert({
      where: { leagueId: competition.leagueId },
      update: {
        isActive: competition.isActive,
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

async function main() {
  await seedCompetitions();
  await seedAdminUser();
}

main()
  .catch((error) => {
    console.error("[db:seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
