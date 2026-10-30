import {
  LEG_FACT_HISTORY_MATCHES,
  LEG_FACT_MAX_LENGTH,
  LEG_FACT_MIN_MATCHES,
  LEG_FACT_MIN_SHARE,
  LEG_FACT_MIN_STREAK,
} from '@config/leg-fact.constants';

/** A finished match of a team, seen from that team. */
export type PastMatch = {
  atHome: boolean;
  goalsFor: number;
  goalsAgainst: number;
  halfTimeFor: number | null;
  halfTimeAgainst: number | null;
  /** Corners of both sides; null when the statistic was not collected. */
  corners: number | null;
};

export type FactTeam = {
  name: string;
  shortName: string;
  /** Most recent first, played before the generation. */
  history: readonly PastMatch[];
};

export type LegFactInput = {
  market: string;
  pick: string;
  /** The line column, for the markets that carry it (corners, lot 6). */
  line: number | null;
  home: FactTeam;
  away: FactTeam;
};

type Side = 'home' | 'away';

/** One wording, or several from the fullest to the shortest. */
type Wording = string | readonly string[];

/** The numbers a sentence quotes: `hits` matches out of `of`. */
type Quote = { team: string; venue: string; hits: number; of: number };

/** What a match must show for the bet's fact, and how to say it. */
type Claim = {
  holds: (match: PastMatch) => boolean | null;
  floor: number;
  /** « PSG a gagné ses 9 derniers matchs à domicile » (hits = of). */
  streak: (quote: Quote) => Wording;
  /** « PSG a gagné 8 de ses 10 derniers matchs à domicile ». */
  share: (quote: Quote) => Wording;
};

type Stat = { kind: 'streak' | 'share'; hits: number; of: number };

/**
 * The fact under a coupon leg (docs/refonte-ui/04 § 1): one sentence about
 * the team the bet speaks of, at the venue it plays, chosen by the bet (a
 * win speaks of wins, a total of goals). Empty when nothing is solid: a run
 * of LEG_FACT_MIN_STREAK straight matches, or a share above the bet's floor
 * over at least LEG_FACT_MIN_MATCHES matches. Never longer than
 * LEG_FACT_MAX_LENGTH: « derniers » without « matchs », then the short name,
 * then nothing.
 */
export function legFact(input: LegFactInput): string {
  const target = claimOf(input);
  if (!target) return '';
  let best: { team: FactTeam; side: Side; stat: Stat } | null = null;
  for (const side of target.sides) {
    const team = side === 'home' ? input.home : input.away;
    const stat = statOf(team.history, side, target.claim);
    if (stat && (!best || stronger(stat, best.stat)))
      best = { team, side, stat };
  }
  if (!best) return '';
  const venue = best.side === 'home' ? ' à domicile' : " à l'extérieur";
  const { stat, team } = best;
  for (const name of [team.name, team.shortName]) {
    const quote = { team: name, venue, hits: stat.hits, of: stat.of };
    const wording =
      stat.kind === 'streak'
        ? target.claim.streak(quote)
        : target.claim.share(quote);
    for (const sentence of typeof wording === 'string' ? [wording] : wording) {
      // « ses 10 derniers matchs » reads the same as « ses 10 derniers ».
      for (const variant of [
        sentence,
        sentence.replace(' derniers matchs', ' derniers'),
      ]) {
        if (variant.length <= LEG_FACT_MAX_LENGTH) return variant;
      }
    }
  }
  return '';
}

/** The latest matches at the venue where the claim can be checked. */
function statOf(
  history: readonly PastMatch[],
  side: Side,
  claim: Claim,
): Stat | null {
  const checks = history
    .filter((match) => match.atHome === (side === 'home'))
    .map((match) => claim.holds(match))
    .filter((value): value is boolean => value !== null)
    .slice(0, LEG_FACT_HISTORY_MATCHES);
  const run = checks.findIndex((value) => !value);
  const streak = run === -1 ? checks.length : run;
  if (streak >= LEG_FACT_MIN_STREAK) {
    return { kind: 'streak', hits: streak, of: streak };
  }
  const hits = checks.filter(Boolean).length;
  if (
    checks.length >= LEG_FACT_MIN_MATCHES &&
    hits / checks.length >= claim.floor
  ) {
    return { kind: 'share', hits, of: checks.length };
  }
  return null;
}

/** A run beats a share; then the higher share, then the longer record. */
function stronger(a: Stat, b: Stat): boolean {
  if (a.kind !== b.kind) return a.kind === 'streak';
  const shareA = a.hits / a.of;
  const shareB = b.hits / b.of;
  return shareA !== shareB ? shareA > shareB : a.of > b.of;
}

function claimOf(
  input: LegFactInput,
): { claim: Claim; sides: readonly Side[] } | null {
  const both: readonly Side[] = ['home', 'away'];
  const sideOf = (pick: string): Side | null =>
    pick === 'HOME' ? 'home' : pick === 'AWAY' ? 'away' : null;
  const { market, pick } = input;
  switch (market) {
    case 'ONE_X_TWO':
    case 'DRAW_NO_BET': {
      if (market === 'ONE_X_TWO' && pick === 'DRAW') {
        return { claim: DRAW, sides: both };
      }
      const side = sideOf(pick);
      return side ? { claim: WIN, sides: [side] } : null;
    }
    case 'DOUBLE_CHANCE':
      if (pick === '1X') return { claim: UNBEATEN, sides: ['home'] };
      if (pick === 'X2') return { claim: UNBEATEN, sides: ['away'] };
      if (pick === '12') return { claim: NO_DRAW, sides: both };
      return null;
    case 'FIRST_HALF_WINNER': {
      if (pick === 'DRAW') return { claim: HALF_TIME_DRAW, sides: both };
      const side = sideOf(pick);
      return side ? { claim: HALF_TIME_LEAD, sides: [side] } : null;
    }
    case 'BTTS':
      if (pick === 'YES') return { claim: BOTH_SCORED, sides: both };
      if (pick === 'NO') return { claim: ONE_BLANK, sides: both };
      return null;
    case 'OVER_UNDER':
    case 'CORNERS':
    case 'TEAM_TOTAL_HOME':
    case 'TEAM_TOTAL_AWAY': {
      const total = totalOf(pick, input.line);
      if (!total) return null;
      if (market === 'OVER_UNDER') {
        return { claim: matchGoals(total), sides: both };
      }
      if (market === 'CORNERS') {
        return { claim: matchCorners(total), sides: both };
      }
      return {
        claim: teamGoals(total),
        sides: [market === 'TEAM_TOTAL_HOME' ? 'home' : 'away'],
      };
    }
    default:
      return null;
  }
}

type Total = { over: boolean; line: number };

/**
 * OVER_2_5 carries its line in the pick (markets added before 2026-09-15);
 * the line column, when set, is the only source for the others.
 */
function totalOf(pick: string, line: number | null): Total | null {
  const match = /^(OVER|UNDER)(?:_(\d+)_(\d+))?$/.exec(pick);
  if (!match) return null;
  const over = match[1] === 'OVER';
  if (line !== null) return { over, line };
  if (match[2] === undefined || match[3] === undefined) return null;
  return { over, line: Number(`${match[2]}.${match[3]}`) };
}

/** « de PSG », « d'Austin » : the elision before a vowel. */
export const of = (team: string): string =>
  /^[aeiouyàâäéèêëîïôöûüÿ]/i.test(team) ? `d'${team}` : `de ${team}`;

const plural = (count: number, word: string): string =>
  `${count} ${word}${count > 1 ? 's' : ''}`;

const WIN: Claim = {
  holds: (m) => m.goalsFor > m.goalsAgainst,
  floor: LEG_FACT_MIN_SHARE.common,
  streak: ({ team: t, hits: n, venue: v }) =>
    `${t} a gagné ses ${n} derniers matchs${v}`,
  share: ({ team: t, hits: k, of: n, venue: v }) =>
    `${t} a gagné ${k} de ses ${n} derniers matchs${v}`,
};

const UNBEATEN: Claim = {
  holds: (m) => m.goalsFor >= m.goalsAgainst,
  floor: LEG_FACT_MIN_SHARE.common,
  streak: ({ team: t, hits: n, venue: v }) =>
    `${t} est invaincu sur ses ${n} derniers matchs${v}`,
  share: ({ team: t, hits: k, of: n, venue: v }) =>
    `${t} invaincu dans ${k} de ses ${n} derniers matchs${v}`,
};

const NO_DRAW: Claim = {
  holds: (m) => m.goalsFor !== m.goalsAgainst,
  floor: LEG_FACT_MIN_SHARE.common,
  streak: ({ team: t, hits: n, venue: v }) =>
    `Aucun nul dans les ${n} derniers matchs ${of(t)}${v}`,
  share: ({ team: t, hits: k, of: n, venue: v }) =>
    `Pas de nul dans ${k} des ${n} derniers matchs ${of(t)}${v}`,
};

const DRAW: Claim = {
  holds: (m) => m.goalsFor === m.goalsAgainst,
  floor: LEG_FACT_MIN_SHARE.draw,
  streak: ({ team: t, hits: n, venue: v }) => `${t} : ${n} nuls de suite${v}`,
  share: ({ team: t, hits: k, of: n, venue: v }) =>
    `${t} : ${k} nuls sur ses ${n} derniers matchs${v}`,
};

const halfTime = (m: PastMatch): { for: number; against: number } | null =>
  m.halfTimeFor === null || m.halfTimeAgainst === null
    ? null
    : { for: m.halfTimeFor, against: m.halfTimeAgainst };

const HALF_TIME_DRAW: Claim = {
  holds: (m) => {
    const ht = halfTime(m);
    return ht && ht.for === ht.against;
  },
  floor: LEG_FACT_MIN_SHARE.halfTimeDraw,
  streak: ({ team: t, hits: n, venue: v }) =>
    `Nul à la pause dans les ${n} derniers matchs ${of(t)}${v}`,
  share: ({ team: t, hits: k, of: n, venue: v }) =>
    `Nul à la pause dans ${k} des ${n} derniers matchs ${of(t)}${v}`,
};

const HALF_TIME_LEAD: Claim = {
  holds: (m) => {
    const ht = halfTime(m);
    return ht && ht.for > ht.against;
  },
  floor: LEG_FACT_MIN_SHARE.common,
  streak: ({ team: t, hits: n, venue: v }) => [
    `${t} menait à la pause lors de ses ${n} derniers${v}`,
    `${t} devant à la pause sur ses ${n} derniers${v}`,
  ],
  share: ({ team: t, hits: k, of: n, venue: v }) => [
    `${t} menait à la pause dans ${k} de ses ${n} derniers${v}`,
    `${t} devant à la pause dans ${k} de ses ${n} derniers${v}`,
  ],
};

const BOTH_SCORED: Claim = {
  holds: (m) => m.goalsFor > 0 && m.goalsAgainst > 0,
  floor: LEG_FACT_MIN_SHARE.common,
  streak: ({ team: t, hits: n, venue: v }) =>
    `Les deux ont marqué lors des ${n} derniers matchs ${of(t)}${v}`,
  share: ({ team: t, hits: k, of: n, venue: v }) =>
    `Les deux ont marqué dans ${k} des ${n} derniers matchs ${of(t)}${v}`,
};

const ONE_BLANK: Claim = {
  holds: (m) => m.goalsFor === 0 || m.goalsAgainst === 0,
  floor: LEG_FACT_MIN_SHARE.common,
  streak: ({ team: t, hits: n, venue: v }) =>
    `Un camp muet lors des ${n} derniers matchs ${of(t)}${v}`,
  share: ({ team: t, hits: k, of: n, venue: v }) =>
    `Un camp muet dans ${k} des ${n} derniers matchs ${of(t)}${v}`,
};

/**
 * « Plus de 2,5 buts » is said « au moins 3 buts »: the same bet, in whole
 * goals. A line is always a half (x,5) on these markets.
 */
function bound(total: Total, word: string): string {
  if (total.over) return `au moins ${plural(Math.ceil(total.line), word)}`;
  const most = Math.floor(total.line);
  return most === 0 ? `aucun ${word}` : `au plus ${plural(most, word)}`;
}

const capitalised = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

const lower = (text: string): string =>
  text.charAt(0).toLowerCase() + text.slice(1);

function matchGoals(total: Total): Claim {
  const words = capitalised(bound(total, 'but'));
  return {
    holds: (m) => {
      const goals = m.goalsFor + m.goalsAgainst;
      return total.over ? goals > total.line : goals < total.line;
    },
    floor: LEG_FACT_MIN_SHARE.common,
    streak: ({ team: t, hits: n, venue: v }) => [
      `${words} lors des ${n} derniers matchs ${of(t)}${v}`,
      `${t} : ${lower(words)} sur ses ${n} derniers${v}`,
    ],
    share: ({ team: t, hits: k, of: n, venue: v }) => [
      `${words} dans ${k} des ${n} derniers matchs ${of(t)}${v}`,
      `${t} : ${lower(words)} dans ${k} de ses ${n} derniers${v}`,
    ],
  };
}

function matchCorners(total: Total): Claim {
  const words = capitalised(bound(total, 'corner'));
  return {
    holds: (m) =>
      m.corners === null
        ? null
        : total.over
          ? m.corners > total.line
          : m.corners < total.line,
    floor: LEG_FACT_MIN_SHARE.common,
    streak: ({ team: t, hits: n, venue: v }) => [
      `${words} lors des ${n} derniers matchs ${of(t)}${v}`,
      `${t} : ${lower(words)} sur ses ${n} derniers${v}`,
    ],
    share: ({ team: t, hits: k, of: n, venue: v }) => [
      `${words} dans ${k} des ${n} derniers matchs ${of(t)}${v}`,
      `${t} : ${lower(words)} dans ${k} de ses ${n} derniers${v}`,
    ],
  };
}

function teamGoals(total: Total): Claim {
  // « A marqué » for the first goal, « n'a pas marqué » under half a goal,
  // « au moins 2 buts » or « au plus 1 but » otherwise, shortened to
  // « PSG : au plus 1 but sur ses 6 derniers » when the line runs long.
  if (total.line < 1) {
    const scored = total.over ? 'a marqué' : "n'a pas marqué";
    return {
      holds: (m) =>
        total.over ? m.goalsFor > total.line : m.goalsFor < total.line,
      floor: LEG_FACT_MIN_SHARE.common,
      streak: ({ team: t, hits: n, venue: v }) =>
        `${t} ${scored} lors de ses ${n} derniers matchs${v}`,
      share: ({ team: t, hits: k, of: n, venue: v }) =>
        `${t} ${scored} dans ${k} de ses ${n} derniers matchs${v}`,
    };
  }
  const goals = bound(total, 'but');
  return {
    holds: (m) =>
      total.over ? m.goalsFor > total.line : m.goalsFor < total.line,
    floor: LEG_FACT_MIN_SHARE.common,
    streak: ({ team: t, hits: n, venue: v }) => [
      `${t} a marqué ${goals} lors de ses ${n} derniers matchs${v}`,
      `${t} : ${goals} sur ses ${n} derniers${v}`,
    ],
    share: ({ team: t, hits: k, of: n, venue: v }) => [
      `${t} a marqué ${goals} dans ${k} de ses ${n} derniers matchs${v}`,
      `${t} : ${goals} dans ${k} de ses ${n} derniers${v}`,
    ],
  };
}
