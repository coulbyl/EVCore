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

export type ProposalKind = "auto" | "rollback" | "shadow";

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

export function proposalKind(notes: string | null): ProposalKind {
  if (notes?.startsWith("Rollback")) return "rollback";
  if (notes?.startsWith("Shadow")) return "shadow";
  return "auto";
}
