export type WeightMap = {
  recentForm: number;
  xg: number;
  domExtPerf: number;
  leagueVolat: number;
};

export type AdjustmentProposalStatus =
  | "APPLIED"
  | "PENDING"
  | "REJECTED"
  | "FROZEN";

export type AdjustmentProposal = {
  id: string;
  currentWeights: WeightMap;
  proposedWeights: WeightMap;
  calibrationError: number;
  triggerBetCount: number;
  status: AdjustmentProposalStatus;
  appliedAt: string | null;
  createdAt: string;
  notes: string | null;
};
