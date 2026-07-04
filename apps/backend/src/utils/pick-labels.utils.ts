// French display labels for market/pick/result — shared by any human- or
// LLM-facing text rendering of picks (analysis-sheet, reports). Channels are
// rendered with their canonical names (VALUE, SAFE, …), never aliased.
// Mirrors the label tables in packages/db/scripts/audit-fixtures.ts (kept in
// sync manually — that CLI script lives in a separate package with its own
// build step, not wired into the backend's module graph).

export function singlePickLabel(market: string, pick: string): string {
  if (market === 'ONE_X_TWO') {
    if (pick === 'HOME') return 'V1';
    if (pick === 'DRAW') return 'NUL';
    if (pick === 'AWAY') return 'V2';
  }
  if (market === 'OVER_UNDER') {
    if (pick === 'OVER_1_5') return 'PLUS DE 1.5';
    if (pick === 'UNDER_1_5') return 'MOINS DE 1.5';
    if (pick === 'OVER') return 'PLUS DE 2.5';
    if (pick === 'UNDER') return 'MOINS DE 2.5';
    if (pick === 'OVER_3_5') return 'PLUS DE 3.5';
    if (pick === 'UNDER_3_5') return 'MOINS DE 3.5';
    if (pick === 'OVER_4_5') return 'PLUS DE 4.5';
    if (pick === 'UNDER_4_5') return 'MOINS DE 4.5';
  }
  if (market === 'BTTS') {
    if (pick === 'YES') return 'BB OUI';
    if (pick === 'NO') return 'BB NON';
  }
  if (market === 'OVER_UNDER_HT') {
    if (pick === 'OVER_0_5') return 'PLUS DE 0.5 MT';
    if (pick === 'UNDER_0_5') return 'MOINS DE 0.5 MT';
    if (pick === 'OVER_1_5') return 'PLUS DE 1.5 MT';
    if (pick === 'UNDER_1_5') return 'MOINS DE 1.5 MT';
  }
  if (market === 'FIRST_HALF_WINNER') {
    if (pick === 'HOME') return 'MT V1';
    if (pick === 'DRAW') return 'MT NUL';
    if (pick === 'AWAY') return 'MT V2';
  }
  if (market === 'HALF_TIME_FULL_TIME') {
    if (pick === 'HOME_HOME') return 'V1 / V1';
    if (pick === 'HOME_DRAW') return 'V1 / NUL';
    if (pick === 'HOME_AWAY') return 'V1 / V2';
    if (pick === 'DRAW_HOME') return 'NUL / V1';
    if (pick === 'DRAW_DRAW') return 'NUL / NUL';
    if (pick === 'DRAW_AWAY') return 'NUL / V2';
    if (pick === 'AWAY_HOME') return 'V2 / V1';
    if (pick === 'AWAY_DRAW') return 'V2 / NUL';
    if (pick === 'AWAY_AWAY') return 'V2 / V2';
  }
  if (market === 'CORRECT_SCORE') return pick;
  return `${market}/${pick}`;
}

export function pickLabel(input: {
  market: string;
  pick: string;
  comboMarket?: string | null;
  comboPick?: string | null;
}): string {
  const { market, pick, comboMarket, comboPick } = input;
  const base = singlePickLabel(market, pick);
  if (comboMarket && comboPick) {
    return `${base} + ${singlePickLabel(comboMarket, comboPick)}`;
  }
  return base;
}

export function resultLabel(result: string | null): string {
  if (result === 'WON') return 'GAGNÉ';
  if (result === 'LOST') return 'PERDU';
  if (result === 'VOID') return 'ANNULÉ';
  return 'EN ATTENTE';
}

export function fmtSigned(n: number, decimals = 4): string {
  const s = n.toFixed(decimals);
  return n >= 0 ? `+${s}` : s;
}

export function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`;
}
