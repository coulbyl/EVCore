export type ActiveMarketSuspension = {
  market: string;
  reason: string;
  triggeredBy: string;
  createdAt: string;
};

export type RiskAlertType = "MARKET_SUSPENSION" | "ROI_ALERT" | "BRIER_ALERT";

export type RiskAlert = {
  id: string;
  type: RiskAlertType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};
