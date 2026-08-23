import type {
  InvestmentChannel,
  InvestmentPick,
} from "@/domains/investment/types/investment";

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

// Un ROI de canal se lit signé : « +2.2% » et « −6.9% » ne disent pas la même
// chose, et laisser tomber le signe transforme une perte en chiffre neutre.
export function formatRoi(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`;
}

// Ordre du filtre par canal : les mieux mesurés d'abord. Purement un ordre
// d'affichage — le contenu de « Ce qu'on assume » est décidé côté serveur par
// le ROI shrinké recalculé, jamais par cette liste.
export const CHANNEL_FILTER_ORDER: InvestmentChannel[] = [
  "DOUBLE_CHANCE",
  "DRAW",
  "VALUE",
  "DOMINANT",
  "TEAM_TOTAL",
  "DRAW_NO_BET",
  "GOALS",
  "OVER_UNDER_HT",
  "FIRST_HALF",
  "RESULT_TOTAL_GOALS",
  "WIN_EITHER_HALF",
  "BTTS",
  "RESULT_BTTS",
  "SAFE",
  "CLEAN_SHEET",
  "HALF_TIME_FULL_TIME",
  "WIN_TO_NIL",
];

export type InvestmentFixtureGroup = {
  fixtureId: string;
  fixtureStatus: InvestmentPick["fixtureStatus"];
  fixture: string;
  competition: string | null;
  country: string | null;
  kickoff: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeNewCoach: boolean;
  awayNewCoach: boolean;
  score: string | null;
  htScore: string | null;
  picks: InvestmentPick[];
};

// Several channels can each select a pick on the same fixture — the API
// returns one InvestmentPick per (fixture, channel), so group them here to
// show one card per match with all its qualifying picks, instead of
// scattering the same match across separate cards. Preserves the incoming
// order (already ranked by calibrated probability) both across groups and
// within each group.
export function groupPicksByFixture(
  picks: InvestmentPick[],
): InvestmentFixtureGroup[] {
  const map = new Map<string, InvestmentFixtureGroup>();
  const order: string[] = [];
  for (const pick of picks) {
    let group = map.get(pick.fixtureId);
    if (!group) {
      group = {
        fixtureId: pick.fixtureId,
        fixtureStatus: pick.fixtureStatus,
        fixture: pick.fixture,
        competition: pick.competition,
        country: pick.country,
        kickoff: pick.kickoff,
        homeLogo: pick.homeLogo,
        awayLogo: pick.awayLogo,
        homeNewCoach: pick.homeNewCoach,
        awayNewCoach: pick.awayNewCoach,
        score: pick.score,
        htScore: pick.htScore,
        picks: [],
      };
      map.set(pick.fixtureId, group);
      order.push(pick.fixtureId);
    }
    group.picks.push(pick);
  }
  return order.map((id) => map.get(id)!);
}
