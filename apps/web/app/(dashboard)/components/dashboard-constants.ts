import type { DashboardSummary } from "@/domains/dashboard/types/dashboard";

export const EMPTY_SUMMARY: DashboardSummary = {
  dashboardKpis: [
    {
      label: "Matchs planifiés",
      value: "0",
      delta: "+0 vs hier",
      tone: "accent",
    },
    {
      label: "Matchs avec cotes",
      value: "0",
      delta: "0,0% de couverture",
      tone: "success",
    },
    {
      label: "Scorings du jour",
      value: "0",
      delta: "0 analysés",
      tone: "warning",
    },
    {
      label: "Alertes actives",
      value: "00",
      delta: "0 haute priorité",
      tone: "danger",
    },
  ],
  workerStatuses: [],
  activeAlerts: [],
  couponSnapshots: [],
  topOpportunities: [],
  selectedFixture: {
    fixtureId: "",
    fixture: "Aucun match",
    homeLogo: null,
    awayLogo: null,
    competition: "-",
    startTime: "--:--",
    market: "-",
    pick: "-",
    modelConfidence: "Aucune donnée disponible.",
    notes: ["Aucun run modèle disponible."],
    metrics: [
      { label: "EV", value: "+0.000", tone: "accent" },
      { label: "Qualité", value: "0", tone: "success" },
      { label: "Déterministe", value: "0.00", tone: "warning" },
      { label: "Cotes", value: "0.00", tone: "neutral" },
    ],
  },
  activityFeed: [],
  pnlSummary: {
    settledBets: 0,
    wonBets: 0,
    winRate: "0.0%",
    netUnits: "+0.000",
    roi: "+0.0%",
  },
};
