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
  pnlSummary: {
    settledBets: 0,
    wonBets: 0,
    winRate: "0.0%",
    netUnits: "+0.000",
    roi: "+0.0%",
  },
};
