export type MlModelMetrics = {
  brierScore: number;
  calibrationError: number;
  roiShadow: number;
  sampleSize: number;
  trainSize: number;
  testSize: number;
};

export type MlModelVersion = {
  id: string;
  createdAt: string;
  segment: string;
  algorithm: string;
  features: string[];
  metrics: MlModelMetrics;
  modelPath: string | null;
  isActive: boolean;
  activatedAt: string | null;
  notes: string | null;
};

export type BackfillResult = {
  queued: number;
  seasonIds: string[];
};

export type TrainResult = {
  jobId: string;
};
