export type { RenderedEmail } from "./types";
export type { RoiAlertProps } from "./types";
export type { MarketSuspensionProps } from "./types";
export type { BrierAlertProps } from "./types";
export type { EtlFailureProps } from "./types";
export type { WeightAdjustmentProps } from "./types";
export type { WeeklyReportProps } from "./types";
export type { XgUnavailableReportProps } from "./types";
export type { DailyCouponProps, DailyCouponLeg } from "./types";

export { renderRoiAlert } from "./emails/roi-alert";
export { renderDailyCoupon } from "./emails/daily-coupon";
export { renderMarketSuspension } from "./emails/market-suspension";
export { renderBrierAlert } from "./emails/brier-alert";
export { renderEtlFailure } from "./emails/etl-failure";
export { renderWeightAdjustment } from "./emails/weight-adjustment";
export { renderWeeklyReport } from "./emails/weekly-report";
export { renderXgUnavailableReport } from "./emails/xg-unavailable-report";
