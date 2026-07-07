// French display labels for market/pick/result — shared by any human- or
// LLM-facing text rendering of picks (analysis-sheet, reports). Channels are
// rendered with their canonical names (VALUE, SAFE, …), never aliased.
// Mirrors the label tables in packages/db/scripts/audit-fixtures.ts (kept in
// sync manually — that CLI script lives in a separate package with its own
// build step, not wired into the backend's module graph).

export function singlePickLabel(market: string, pick: string): string {
  if (market === 'ONE_X_TWO') {
    if (pick === 'HOME') return 'Victoire domicile';
    if (pick === 'DRAW') return 'Match nul';
    if (pick === 'AWAY') return 'Victoire extérieur';
  }
  if (market === 'OVER_UNDER') {
    if (pick === 'OVER_1_5') return 'Plus de 1.5 but';
    if (pick === 'UNDER_1_5') return 'Moins de 1.5 but';
    if (pick === 'OVER') return 'Plus de 2.5 buts';
    if (pick === 'UNDER') return 'Moins de 2.5 buts';
    if (pick === 'OVER_3_5') return 'Plus de 3.5 buts';
    if (pick === 'UNDER_3_5') return 'Moins de 3.5 buts';
    if (pick === 'OVER_4_5') return 'Plus de 4.5 buts';
    if (pick === 'UNDER_4_5') return 'Moins de 4.5 buts';
  }
  if (market === 'BTTS') {
    if (pick === 'YES') return 'Les deux équipes marquent : oui';
    if (pick === 'NO') return 'Les deux équipes marquent : non';
  }
  if (market === 'DOUBLE_CHANCE') {
    if (pick === '1X') return 'Domicile ou match nul';
    if (pick === 'X2') return 'Match nul ou extérieur';
    if (pick === '12') return 'Domicile ou extérieur';
  }
  if (market === 'OVER_UNDER_HT') {
    if (pick === 'OVER_0_5') return 'Plus de 0.5 but (mi-temps)';
    if (pick === 'UNDER_0_5') return 'Moins de 0.5 but (mi-temps)';
    if (pick === 'OVER_1_5') return 'Plus de 1.5 but (mi-temps)';
    if (pick === 'UNDER_1_5') return 'Moins de 1.5 but (mi-temps)';
  }
  if (market === 'FIRST_HALF_WINNER') {
    if (pick === 'HOME') return 'Victoire domicile (mi-temps)';
    if (pick === 'DRAW') return 'Match nul (mi-temps)';
    if (pick === 'AWAY') return 'Victoire extérieur (mi-temps)';
  }
  if (market === 'HALF_TIME_FULL_TIME') {
    const htftLabels: Record<string, string> = {
      HOME_HOME: 'Domicile / Domicile',
      HOME_DRAW: 'Domicile / Nul',
      HOME_AWAY: 'Domicile / Extérieur',
      DRAW_HOME: 'Nul / Domicile',
      DRAW_DRAW: 'Nul / Nul',
      DRAW_AWAY: 'Nul / Extérieur',
      AWAY_HOME: 'Extérieur / Domicile',
      AWAY_DRAW: 'Extérieur / Nul',
      AWAY_AWAY: 'Extérieur / Extérieur',
    };
    return htftLabels[pick] ?? pick;
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
