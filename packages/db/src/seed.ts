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
    isActive: false,
    csvDivisionCode: "F1",
  },
  {
    leagueId: 40,
    code: "CH",
    name: "Championship",
    country: "England",
    isActive: false,
    csvDivisionCode: "E1",
  },
  {
    leagueId: 136,
    code: "I2",
    name: "Serie B",
    country: "Italy",
    isActive: false,
    includeInBacktest: false,
    csvDivisionCode: "I2",
  },
  {
    leagueId: 141,
    code: "SP2",
    name: "Segunda Division",
    country: "Spain",
    isActive: true,
    includeInBacktest: true,
    csvDivisionCode: "SP2",
  },
  {
    leagueId: 79,
    code: "D2",
    name: "2. Bundesliga",
    country: "Germany",
    isActive: false,
    includeInBacktest: false,
    csvDivisionCode: "D2",
  },
  {
    leagueId: 62,
    code: "F2",
    name: "Ligue 2",
    country: "France",
    isActive: false,
    includeInBacktest: false,
    csvDivisionCode: "F2",
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
