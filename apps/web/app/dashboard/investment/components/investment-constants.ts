import type { InvestmentPick } from "@/domains/investment/types/investment";

export function formatPct(n: number): string {
  return `${(n * 100).toFixed(0)}%`;
}

export function formatEv(ev: number | null): string | null {
  return ev === null ? null : `${ev >= 0 ? "+" : ""}${(ev * 100).toFixed(0)}%`;
}

export type InvestmentFixtureGroup = {
  fixtureId: string;
  fixture: string;
  competition: string | null;
  country: string | null;
  kickoff: string;
  homeLogo: string | null;
  awayLogo: string | null;
  score: string | null;
  htScore: string | null;
  picks: InvestmentPick[];
};

// Several channels can each select a pick on the same fixture — the API
// returns one InvestmentPick per (fixture, channel), so group them here to
// show one card per match with all its qualifying picks, instead of
// scattering the same match across separate cards. Preserves the incoming
// order (already ranked by probability bucket) both across groups and within
// each group.
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
        fixture: pick.fixture,
        competition: pick.competition,
        country: pick.country,
        kickoff: pick.kickoff,
        homeLogo: pick.homeLogo,
        awayLogo: pick.awayLogo,
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
