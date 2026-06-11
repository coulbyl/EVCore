export type PromotionVerdict =
  | "GO"
  | "WATCH"
  | "NO_GO"
  | "INSUFFICIENT"
  | "META_ONLY";

export type PromotionWindow = "P7D" | "P30D" | "P90D" | "SINCE_ACTIVATION";

export type SegmentComparison = {
  sampleSize: number;
  baselineBrier: number;
  correctedBrier: number;
  baselineRoi: number;
  correctedRoi: number | null;
};

export type ActiveModelMeta = {
  versionId: string;
  algorithm: string;
  activatedAt: string | null;
  brierScore: number | null;
  roiShadow: number | null;
  roiShadowLegacy: boolean;
};

export type SegmentReportRow = {
  segment: string;
  verdict: PromotionVerdict;
  comparison: SegmentComparison | null;
  brierImprovement: number | null;
  activeModel: ActiveModelMeta | null;
};

export type MlPromotionReport = {
  window: PromotionWindow;
  from: string;
  to: string;
  asOf: string | null;
  rule: string;
  segments: SegmentReportRow[];
};
