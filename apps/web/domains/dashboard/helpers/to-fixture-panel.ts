import type {
  FixturePanel,
  OpportunityRow,
} from "@/domains/dashboard/types/dashboard";

export function toFixturePanel(row: OpportunityRow): FixturePanel {
  return {
    fixtureId: row.fixtureId,
    fixture: row.fixture,
    homeLogo: row.homeLogo,
    awayLogo: row.awayLogo,
    competition: row.competition,
    startTime: row.kickoff,
    market: row.market,
    pick: row.pick,
    modelConfidence:
      "Sélection calculée à partir des dernières exécutions du modèle.",
    notes: [
      `score qualité ${row.quality}`,
      `déterministe ${row.deterministic}`,
    ],
    metrics: [
      { label: "EV", value: row.ev, tone: "accent" },
      { label: "Qualité", value: row.quality, tone: "success" },
      { label: "Déterministe", value: row.deterministic, tone: "warning" },
      { label: "Cotes", value: row.odds, tone: "neutral" },
    ],
  };
}
