export type SummaryChannel = 'EV' | 'SV' | 'CONF' | 'DRAW' | 'BTTS';
export type SummaryPeriod = '7d' | '30d' | '3m';

export type SummaryStats = {
  total: number;
  won: number;
  lost: number;
};

export type SummaryProgressionPoint = {
  date: string;
  won: number;
  lost: number;
};

export type SummaryPickRow = {
  fixtureId: string;
  fixture: string;
  homeLogo: string | null;
  awayLogo: string | null;
  competition: string;
  competitionCode: string;
  scheduledAt: string;
  market: string;
  pick: string;
  comboMarket: string | null;
  comboPick: string | null;
  odds: string | null;
  ev: string | null;
  result: 'WON' | 'LOST';
  channel: SummaryChannel;
};

export type SummaryResponse = {
  channel: SummaryChannel;
  stats: SummaryStats;
  progression: SummaryProgressionPoint[];
  picks: SummaryPickRow[];
};
