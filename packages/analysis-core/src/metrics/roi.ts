// Pure ROI / equity-curve helpers — no I/O, no infra dependencies.

export type EvBin = {
  label: string;
  from: number | null;
  to: number | null;
  total: number;
  won: number;
  hitRate: number;
  roi: number;
};

// EV-bin edges (shared with the /coupons/roi promotion view).
const EV_BIN_EDGES: { label: string; from: number; to: number }[] = [
  { label: "< 0%", from: -Infinity, to: 0 },
  { label: "0–4%", from: 0, to: 0.04 },
  { label: "4–8%", from: 0.04, to: 0.08 },
  { label: "8–15%", from: 0.08, to: 0.15 },
  { label: "≥ 15%", from: 0.15, to: Infinity },
];

export type Settled = { won: boolean; odds: number; ev: number | null };

export function flatRoi(items: { won: boolean; odds: number }[]): number {
  if (items.length === 0) return 0;
  return (
    items.reduce((acc, i) => acc + (i.won ? i.odds - 1 : -1), 0) / items.length
  );
}

export function maxDrawdown(items: { won: boolean; odds: number }[]): number {
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const i of items) {
    equity += i.won ? i.odds - 1 : -1;
    if (equity > peak) peak = equity;
    const dd = peak - equity;
    if (dd > worst) worst = dd;
  }
  return worst;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function evBins(items: Settled[]): EvBin[] {
  const bins: EvBin[] = [];
  for (const edge of EV_BIN_EDGES) {
    const group = items.filter(
      (i) => i.ev !== null && i.ev >= edge.from && i.ev < edge.to,
    );
    if (group.length === 0) continue;
    const won = group.filter((i) => i.won).length;
    bins.push({
      label: edge.label,
      from: finiteOrNull(edge.from),
      to: finiteOrNull(edge.to),
      total: group.length,
      won,
      hitRate: won / group.length,
      roi: flatRoi(group),
    });
  }
  const noEv = items.filter((i) => i.ev === null);
  if (noEv.length > 0) {
    const won = noEv.filter((i) => i.won).length;
    bins.push({
      label: "n/a",
      from: null,
      to: null,
      total: noEv.length,
      won,
      hitRate: won / noEv.length,
      roi: flatRoi(noEv),
    });
  }
  return bins;
}
