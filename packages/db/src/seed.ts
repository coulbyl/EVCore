import "dotenv/config";
import { prisma } from "./client";

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
    isActive: true,
    csvDivisionCode: "MEX",
    seasonStartMonth: 6,
  },
  {
    leagueId: 2,
    code: "UCL",
    name: "Champions League",
    country: "Europe",
    isActive: false,
    includeInBacktest: false,
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
    isActive: true,
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
      },
      create: competition,
    });
  }

  console.log(`[db:seed] competitions upserted: ${COMPETITIONS.length}`);
}

async function main() {
  await seedCompetitions();
}

main()
  .catch((error) => {
    console.error("[db:seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
