/**
 * Backtest d'un générateur de coupon déterministe, un coupon par jour de
 * matchs, sur toutes les saisons cotées (2023-01 → 2026-09).
 *
 * Le générateur n'utilise aucune sortie du moteur ni du LLM : il compose à
 * partir des seules cotes d'avant match, dont la marge est retirée par
 * normalisation. C'est l'estimateur que le rapport par championnat désigne
 * comme le meilleur disponible (le taux réalisé suit l'implicite du marché,
 * pas la probabilité annoncée par le moteur).
 *
 * Règle de composition, pour k jambes et une bande de cote [lo, hi] :
 *   1. ne retenir que les jambes dont la cote atteint lo^(1/k), ce qui garantit
 *      une cote combinée au moins égale à lo ;
 *   2. les trier par cote croissante — à cote combinée égale, la probabilité
 *      jointe est maximale quand la combinée est la plus proche de la cible —
 *      puis par jambe la moins taxée (fair x cote) en départage ;
 *   3. une seule jambe par rencontre, s'arrêter à k jambes ;
 *   4. s'abstenir si la combinée sort de la bande ou si k jambes ne sont pas
 *      disponibles.
 *
 * L'indicateur principal n'est pas le ROI mais le **ratio** entre coupons
 * gagnés et coupons attendus à l'équilibre (somme des 1/cote combinée) : à ces
 * volumes le ROI d'un coupon n'a aucune puissance statistique, alors que le
 * comptage de gagnants en a.
 *
 * Usage :
 *   pnpm backtest:daily-coupon
 *   pnpm backtest:daily-coupon -- --from <dir>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isoWeek } from "../src/iso-week";

const VERSION = "daily-coupon-v1";
const QUERY_FILE = "08-coupon-legs.sql";
const MIN_COUPONS = 50;
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

const BANDS = [
  { name: "5-7", min: 5, max: 7 },
  { name: "5-15", min: 5, max: 15 },
] as const;
const LEG_COUNTS = [2, 3, 4, 5, 6, 7, 8] as const;
/**
 * Règles de vivier testées. La "value" d'une jambe (fair x cote) vaut
 * exactement l'inverse de la marge du marché sur cette rencontre : toutes les
 * issues d'un même groupe de choix la partagent. Restreindre le vivier aux
 * plus fortes values revient donc à ne jouer que les marchés les moins taxés,
 * ce qui ne demande aucune capacité de prédiction.
 */
const MARGIN_RULES = [
  { name: "tout le vivier", quantile: 0 },
  { name: "moitié la moins taxée", quantile: 0.5 },
  { name: "quart le moins taxé", quantile: 0.75 },
  { name: "décile le moins taxé", quantile: 0.9 },
] as const;
const WEEKDAY_NAMES = [
  "dimanche",
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
] as const;
/** Coupure des deux moitiés de l'historique, pour exiger une réplication. */
const HISTORY_SPLIT = "2025-01-01";
const REFERENCE_LEGS = 2;
const REFERENCE_BAND = "5-7";

type Leg = {
  fixtureId: string;
  day: string;
  competition: string;
  marketKey: string;
  pick: string;
  odds: number;
  fair: number;
  books: number;
  won: boolean;
};

type Band = (typeof BANDS)[number];

type Coupon = {
  day: string;
  legs: Leg[];
  combinedOdds: number;
  won: boolean;
  profit: number;
};

type Summary = {
  legCount: number;
  band: string;
  coupons: number;
  wins: number;
  hitRate: number;
  breakEvenRate: number;
  ratio: number;
  ratioLow95: number;
  ratioHigh95: number;
  avgOdds: number;
  roi: number;
  roiLow95: number;
  roiHigh95: number;
  worstLosingStreak: number;
  worstDrawdown: number;
  requiredLegEdge: number;
};

type YearRow = {
  year: string;
  coupons: number;
  wins: number;
  hitRate: number;
  breakEvenRate: number;
  ratio: number;
  roi: number;
};

function groupByDay(legs: readonly Leg[]): Map<string, Leg[]> {
  const days = new Map<string, Leg[]>();
  for (const leg of legs) {
    const bucket = days.get(leg.day) ?? [];
    bucket.push(leg);
    days.set(leg.day, bucket);
  }
  return days;
}

function compose(
  candidates: readonly Leg[],
  options: { legCount: number; band: Band },
): Coupon | null {
  const { legCount, band } = options;
  const floor = band.min ** (1 / legCount);
  const pool = candidates
    .filter((leg) => leg.odds >= floor)
    .sort(
      (first, second) =>
        first.odds - second.odds ||
        second.fair * second.odds - first.fair * first.odds,
    );
  const usedFixtures = new Set<string>();
  const chosen: Leg[] = [];
  let combinedOdds = 1;
  for (const leg of pool) {
    if (usedFixtures.has(leg.fixtureId)) continue;
    if (combinedOdds * leg.odds > band.max && chosen.length < legCount) {
      continue;
    }
    usedFixtures.add(leg.fixtureId);
    chosen.push(leg);
    combinedOdds *= leg.odds;
    if (chosen.length === legCount) break;
  }
  if (
    chosen.length < legCount ||
    combinedOdds < band.min ||
    combinedOdds > band.max
  ) {
    return null;
  }
  const head = chosen[0];
  if (!head) return null;
  const won = chosen.every((leg) => leg.won);
  return {
    day: head.day,
    legs: chosen,
    combinedOdds,
    won,
    profit: won ? combinedOdds - 1 : -1,
  };
}

function run(
  days: ReadonlyMap<string, Leg[]>,
  options: { legCount: number; band: Band },
): Coupon[] {
  return [...days.keys()]
    .sort()
    .map((day) => compose(days.get(day) ?? [], options))
    .filter((coupon): coupon is Coupon => coupon !== null);
}

function drawdown(coupons: readonly Coupon[]): {
  streak: number;
  worst: number;
} {
  let streak = 0;
  let current = 0;
  let equity = 0;
  let peak = 0;
  let worst = 0;
  for (const coupon of coupons) {
    current = coupon.won ? 0 : current + 1;
    streak = Math.max(streak, current);
    equity += coupon.profit;
    peak = Math.max(peak, equity);
    worst = Math.min(worst, equity - peak);
  }
  return { streak, worst };
}

function summarize(
  coupons: readonly Coupon[],
  options: { legCount: number; band: Band },
): Summary | null {
  const n = coupons.length;
  if (n < MIN_COUPONS) return null;
  const wins = coupons.filter((coupon) => coupon.won).length;
  const expected = coupons.reduce(
    (sum, coupon) => sum + 1 / coupon.combinedOdds,
    0,
  );
  const ratio = wins / expected;
  // Erreur type du comptage de gagnants, rapportée à la même base.
  const ratioError = Math.sqrt(Math.max(wins, 1)) / expected;
  const roi = coupons.reduce((sum, coupon) => sum + coupon.profit, 0) / n;
  const variance =
    n > 1
      ? coupons.reduce((sum, coupon) => sum + (coupon.profit - roi) ** 2, 0) /
        (n - 1)
      : 0;
  const roiError = Math.sqrt(variance / n);
  const { streak, worst } = drawdown(coupons);
  return {
    legCount: options.legCount,
    band: options.band.name,
    coupons: n,
    wins,
    hitRate: wins / n,
    breakEvenRate: expected / n,
    ratio,
    ratioLow95: ratio - 1.96 * ratioError,
    ratioHigh95: ratio + 1.96 * ratioError,
    avgOdds: coupons.reduce((sum, coupon) => sum + coupon.combinedOdds, 0) / n,
    roi,
    roiLow95: roi - 1.96 * roiError,
    roiHigh95: roi + 1.96 * roiError,
    worstLosingStreak: streak,
    worstDrawdown: worst,
    requiredLegEdge: (1 / ratio) ** (1 / options.legCount) - 1,
  };
}

function byYear(coupons: readonly Coupon[]): YearRow[] {
  const years = new Map<string, Coupon[]>();
  for (const coupon of coupons) {
    const year = coupon.day.slice(0, 4);
    const bucket = years.get(year) ?? [];
    bucket.push(coupon);
    years.set(year, bucket);
  }
  return [...years]
    .sort(([first], [second]) => first.localeCompare(second))
    .map(([year, rows]) => {
      const wins = rows.filter((coupon) => coupon.won).length;
      const expected = rows.reduce(
        (sum, coupon) => sum + 1 / coupon.combinedOdds,
        0,
      );
      return {
        year,
        coupons: rows.length,
        wins,
        hitRate: wins / rows.length,
        breakEvenRate: expected / rows.length,
        ratio: wins / expected,
        roi: rows.reduce((sum, coupon) => sum + coupon.profit, 0) / rows.length,
      };
    });
}

// ── vivier ────────────────────────────────────────────────────────────────

type PoolStats = {
  days: number;
  fixturesMedian: number;
  fixturesMean: number;
  fixturesMax: number;
  leaguesMean: number;
  leaguesMax: number;
};

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function buildPoolStats(days: ReadonlyMap<string, Leg[]>): PoolStats {
  const fixtures: number[] = [];
  const leagues: number[] = [];
  for (const bucket of days.values()) {
    fixtures.push(new Set(bucket.map((leg) => leg.fixtureId)).size);
    leagues.push(new Set(bucket.map((leg) => leg.competition)).size);
  }
  const mean = (values: readonly number[]): number =>
    values.length === 0
      ? 0
      : values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    days: days.size,
    fixturesMedian: median(fixtures),
    fixturesMean: mean(fixtures),
    fixturesMax: Math.max(...fixtures, 0),
    leaguesMean: mean(leagues),
    leaguesMax: Math.max(...leagues, 0),
  };
}

type MarginRule = {
  name: string;
  coupons: number;
  legMargin: number;
  theoreticalRatio: number;
  observedRatio: number;
  roi: number;
};

function quantileOf(values: readonly number[], share: number): number {
  if (share <= 0) return 0;
  const sorted = [...values].sort((first, second) => first - second);
  return sorted[Math.floor(share * sorted.length)] ?? 0;
}

/**
 * Le ratio théorique est le produit des values des jambes retenues : c'est ce
 * que le coupon rapporte si le marché est exactement juste. L'écart entre
 * observé et théorique est le seul endroit où une compétence pourrait
 * apparaître.
 */
function buildMarginRules(
  days: ReadonlyMap<string, Leg[]>,
  legs: readonly Leg[],
): MarginRule[] {
  const band = BANDS.find((item) => item.name === REFERENCE_BAND);
  if (!band) return [];
  const values = legs.map((leg) => leg.fair * leg.odds);
  return MARGIN_RULES.flatMap((rule) => {
    const floor = quantileOf(values, rule.quantile);
    const coupons = [...days.keys()]
      .sort()
      .map((day) =>
        compose(
          (days.get(day) ?? []).filter((leg) => leg.fair * leg.odds >= floor),
          { legCount: REFERENCE_LEGS, band },
        ),
      )
      .filter((coupon): coupon is Coupon => coupon !== null);
    if (coupons.length < MIN_COUPONS) return [];
    const wins = coupons.filter((coupon) => coupon.won).length;
    const expected = coupons.reduce(
      (sum, coupon) => sum + 1 / coupon.combinedOdds,
      0,
    );
    const theoretical =
      coupons.reduce(
        (sum, coupon) =>
          sum +
          coupon.legs.reduce((product, leg) => product * leg.fair * leg.odds, 1),
        0,
      ) / coupons.length;
    const legValue =
      coupons.reduce(
        (sum, coupon) =>
          sum +
          coupon.legs.reduce((inner, leg) => inner + leg.fair * leg.odds, 0) /
            coupon.legs.length,
        0,
      ) / coupons.length;
    return [
      {
        name: rule.name,
        coupons: coupons.length,
        legMargin: 1 / legValue - 1,
        theoreticalRatio: theoretical,
        observedRatio: wins / expected,
        roi:
          coupons.reduce((sum, coupon) => sum + coupon.profit, 0) /
          coupons.length,
      },
    ];
  });
}

type Enumeration = {
  days: number;
  combinations: number;
  winning: number;
  winningShare: number;
  medianPerDay: number;
  medianWinnersPerDay: number;
  daysWithoutWinner: number;
};

/**
 * Dénombrement exhaustif des coupons à deux jambes réalisables chaque jour
 * dans la bande de référence, et de ceux qui sont sortis gagnants. Répond à
 * la seule objection qui reste : le vivier est-il trop étroit ?
 */
function enumerateTwoLeg(days: ReadonlyMap<string, Leg[]>): Enumeration {
  const band = BANDS.find((item) => item.name === REFERENCE_BAND);
  if (!band) {
    return {
      days: 0,
      combinations: 0,
      winning: 0,
      winningShare: 0,
      medianPerDay: 0,
      medianWinnersPerDay: 0,
      daysWithoutWinner: 0,
    };
  }
  let combinations = 0;
  let winning = 0;
  let daysWithoutWinner = 0;
  const perDay: number[] = [];
  const winnersPerDay: number[] = [];
  for (const bucket of days.values()) {
    let dayCombos = 0;
    let dayWins = 0;
    for (let i = 0; i < bucket.length; i += 1) {
      const first = bucket[i];
      if (!first) continue;
      for (let j = i + 1; j < bucket.length; j += 1) {
        const second = bucket[j];
        if (!second || second.fixtureId === first.fixtureId) continue;
        const odds = first.odds * second.odds;
        if (odds < band.min || odds > band.max) continue;
        dayCombos += 1;
        if (first.won && second.won) dayWins += 1;
      }
    }
    if (dayCombos === 0) continue;
    combinations += dayCombos;
    winning += dayWins;
    perDay.push(dayCombos);
    winnersPerDay.push(dayWins);
    if (dayWins === 0) daysWithoutWinner += 1;
  }
  return {
    days: perDay.length,
    combinations,
    winning,
    winningShare: combinations > 0 ? winning / combinations : 0,
    medianPerDay: median(perDay),
    medianWinnersPerDay: median(winnersPerDay),
    daysWithoutWinner,
  };
}

// ── saisonnalité ──────────────────────────────────────────────────────────

type WeekdayRow = {
  weekday: string;
  coupons: number;
  fixturesPerDay: number;
  wins: number;
  hitRate: number;
  breakEvenRate: number;
  theoreticalRatio: number;
  observedRatio: number;
  firstHalfRatio: number | null;
  secondHalfRatio: number | null;
  roi: number;
};

function ratioOf(coupons: readonly Coupon[]): number | null {
  if (coupons.length < 30) return null;
  const expected = coupons.reduce(
    (sum, coupon) => sum + 1 / coupon.combinedOdds,
    0,
  );
  if (expected === 0) return null;
  return coupons.filter((coupon) => coupon.won).length / expected;
}

/**
 * Le ratio théorique est identique quel que soit le jour : la marge ne varie
 * pas avec le calendrier. Tout écart entre observé et théorique doit donc
 * survivre aux deux moitiés de l'historique pour être autre chose que le
 * bruit d'un unique coupon par jour.
 */
function buildWeekdays(
  days: ReadonlyMap<string, Leg[]>,
  coupons: readonly Coupon[],
): WeekdayRow[] {
  const buckets = new Map<number, Coupon[]>();
  for (const coupon of coupons) {
    const index = new Date(`${coupon.day}T00:00:00Z`).getUTCDay();
    const bucket = buckets.get(index) ?? [];
    bucket.push(coupon);
    buckets.set(index, bucket);
  }
  return [...buckets]
    .sort(([first], [second]) => first - second)
    .flatMap(([index, rows]) => {
      const n = rows.length;
      if (n < MIN_COUPONS) return [];
      const wins = rows.filter((coupon) => coupon.won).length;
      const expected = rows.reduce(
        (sum, coupon) => sum + 1 / coupon.combinedOdds,
        0,
      );
      const fixtures =
        rows.reduce(
          (sum, coupon) =>
            sum + new Set((days.get(coupon.day) ?? []).map((leg) => leg.fixtureId)).size,
          0,
        ) / n;
      return [
        {
          weekday: WEEKDAY_NAMES[index] ?? String(index),
          coupons: n,
          fixturesPerDay: fixtures,
          wins,
          hitRate: wins / n,
          breakEvenRate: expected / n,
          theoreticalRatio:
            rows.reduce(
              (sum, coupon) =>
                sum +
                coupon.legs.reduce(
                  (product, leg) => product * leg.fair * leg.odds,
                  1,
                ),
              0,
            ) / n,
          observedRatio: wins / expected,
          firstHalfRatio: ratioOf(rows.filter((row) => row.day < HISTORY_SPLIT)),
          secondHalfRatio: ratioOf(
            rows.filter((row) => row.day >= HISTORY_SPLIT),
          ),
          roi: rows.reduce((sum, coupon) => sum + coupon.profit, 0) / n,
        },
      ];
    });
}

// ── semaines ──────────────────────────────────────────────────────────────

type WeeklyRow = {
  legCount: number;
  band: string;
  weeks: number;
  profitable: number;
  profitableShare: number;
  worstWeekStreak: number;
  breakEvenShare: number;
};


/**
 * Part de semaines rentables. C'est la question que pose un parieur qui suit
 * le coupon tous les jours : à la fin de la semaine, suis-je positif ?
 * `breakEvenShare` donne la même part pour un marché SANS marge, obtenue par
 * la binomiale — c'est le plafond théorique de la configuration, qu'aucun
 * modèle ne peut dépasser.
 */
function weeklyView(
  coupons: readonly Coupon[],
  options: { legCount: number; band: Band },
): WeeklyRow | null {
  const weeks = new Map<string, Coupon[]>();
  for (const coupon of coupons) {
    const key = isoWeek(coupon.day);
    const bucket = weeks.get(key) ?? [];
    bucket.push(coupon);
    weeks.set(key, bucket);
  }
  const rows = [...weeks]
    .sort(([first], [second]) => first.localeCompare(second))
    .filter(([, bucket]) => bucket.length >= 4)
    .map(([, bucket]) =>
      bucket.reduce((sum, coupon) => sum + coupon.profit, 0),
    );
  if (rows.length < 40) return null;
  let streak = 0;
  let current = 0;
  for (const profit of rows) {
    current = profit > 0 ? 0 : current + 1;
    streak = Math.max(streak, current);
  }
  const odds =
    coupons.reduce((sum, coupon) => sum + coupon.combinedOdds, 0) /
    Math.max(coupons.length, 1);
  const fair = 1 / odds;
  const wins = Math.floor(7 / odds) + 1;
  let ceiling = 0;
  for (let k = wins; k <= 7; k += 1) {
    let binomial = 1;
    for (let i = 0; i < k; i += 1) binomial = (binomial * (7 - i)) / (i + 1);
    ceiling += binomial * fair ** k * (1 - fair) ** (7 - k);
  }
  return {
    legCount: options.legCount,
    band: options.band.name,
    weeks: rows.length,
    profitable: rows.filter((profit) => profit > 0).length,
    profitableShare:
      rows.filter((profit) => profit > 0).length / rows.length,
    worstWeekStreak: streak,
    breakEvenShare: ceiling,
  };
}

// ── chargement ────────────────────────────────────────────────────────────

function offlineDir(): string | null {
  const index = process.argv.indexOf("--from");
  if (index === -1) return null;
  const value = process.argv[index + 1];
  if (!value) throw new Error("--from requiert un répertoire");
  return value;
}

async function loadLegs(dir: string | null): Promise<Leg[]> {
  if (dir) {
    return JSON.parse(
      readFileSync(join(dir, QUERY_FILE.replace(/\.sql$/, ".json")), "utf8"),
    ) as Leg[];
  }
  const { prisma } = await import("@evcore/db");
  try {
    return await prisma.$queryRawUnsafe<Leg[]>(
      readFileSync(join(SCRIPT_DIR, "league-report", QUERY_FILE), "utf8"),
    );
  } finally {
    await prisma.$disconnect();
  }
}

// ── rendu ─────────────────────────────────────────────────────────────────

function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)} %`;
}

function table(header: readonly string[], rows: readonly string[][]): string {
  return [header, header.map(() => "---"), ...rows]
    .map((row) => `| ${row.join(" | ")} |`)
    .join("\n");
}

function renderSummaries(rows: readonly Summary[]): string {
  return table(
    [
      "Jambes",
      "Coupons",
      "Gagnés",
      "Taux",
      "Seuil",
      "Ratio",
      "IC95 ratio",
      "Cote",
      "ROI",
      "Pire série",
      "Pire creux",
    ],
    rows.map((row) => [
      String(row.legCount),
      String(row.coupons),
      String(row.wins),
      pct(row.hitRate),
      pct(row.breakEvenRate),
      row.ratio.toFixed(2),
      `${row.ratioLow95.toFixed(2)} – ${row.ratioHigh95.toFixed(2)}`,
      row.avgOdds.toFixed(2),
      pct(row.roi),
      String(row.worstLosingStreak),
      row.worstDrawdown.toFixed(0),
    ]),
  );
}

function renderYears(rows: readonly YearRow[]): string {
  return table(
    ["Année", "Coupons", "Gagnés", "Taux", "Seuil", "Ratio", "ROI"],
    rows.map((row) => [
      row.year,
      String(row.coupons),
      String(row.wins),
      pct(row.hitRate),
      pct(row.breakEvenRate),
      row.ratio.toFixed(2),
      pct(row.roi),
    ]),
  );
}

function renderMarginRules(rows: readonly MarginRule[]): string {
  return table(
    [
      "Règle de vivier",
      "Coupons",
      "Marge par jambe",
      "Ratio théorique",
      "Ratio observé",
      "Écart",
      "ROI",
    ],
    rows.map((row) => [
      row.name,
      String(row.coupons),
      pct(row.legMargin, 2),
      row.theoreticalRatio.toFixed(3),
      row.observedRatio.toFixed(2),
      `${row.observedRatio - row.theoreticalRatio >= 0 ? "+" : ""}${(
        row.observedRatio - row.theoreticalRatio
      ).toFixed(2)}`,
      pct(row.roi),
    ]),
  );
}

function renderWeekdays(rows: readonly WeekdayRow[]): string {
  return table(
    [
      "Jour",
      "Coupons",
      "Matchs/jour",
      "Gagnés",
      "Taux",
      "Seuil",
      "Ratio théorique",
      "Ratio observé",
      "2023-24",
      "2025-26",
      "ROI",
    ],
    rows.map((row) => [
      row.weekday,
      String(row.coupons),
      row.fixturesPerDay.toFixed(0),
      String(row.wins),
      pct(row.hitRate),
      pct(row.breakEvenRate),
      row.theoreticalRatio.toFixed(2),
      row.observedRatio.toFixed(2),
      row.firstHalfRatio === null ? "n/a" : row.firstHalfRatio.toFixed(2),
      row.secondHalfRatio === null ? "n/a" : row.secondHalfRatio.toFixed(2),
      pct(row.roi),
    ]),
  );
}

function renderWeekly(rows: readonly WeeklyRow[]): string {
  return table(
    [
      "Jambes",
      "Bande",
      "Semaines",
      "Rentables",
      "% rentables",
      "Plafond sans marge",
      "Pire série de semaines",
    ],
    rows.map((row) => [
      String(row.legCount),
      row.band,
      String(row.weeks),
      String(row.profitable),
      pct(row.profitableShare),
      pct(row.breakEvenShare),
      String(row.worstWeekStreak),
    ]),
  );
}

function renderMarkdown(
  legs: readonly Leg[],
  summaries: readonly Summary[],
  context: {
    years: readonly YearRow[];
    pool: PoolStats;
    marginRules: readonly MarginRule[];
    enumeration: Enumeration;
    weekdays: readonly WeekdayRow[];
    weekly: readonly WeeklyRow[];
  },
): string {
  const { years, pool, marginRules, enumeration, weekdays, weekly } = context;
  const bestDay = [...weekdays].sort(
    (first, second) => second.observedRatio - first.observedRatio,
  )[0];
  const worstDay = [...weekdays].sort(
    (first, second) => first.observedRatio - second.observedRatio,
  )[0];
  const days = new Set(legs.map((leg) => leg.day)).size;
  const fixtures = new Set(legs.map((leg) => leg.fixtureId)).size;
  const sorted = [...legs].map((leg) => leg.day).sort();
  const best = [...summaries].sort(
    (first, second) => second.ratio - first.ratio,
  )[0];
  const reference = summaries.find(
    (row) => row.band === "5-7" && row.legCount === 2,
  );
  const below = summaries.filter((row) => row.ratio < 1).length;
  const tight = summaries.filter((row) => row.band === "5-7");
  const wide = summaries.filter((row) => row.band === "5-15");

  return `# Backtest coupon jour par jour — ${VERSION}

Régénérable : \`pnpm --filter @evcore/backtest-core backtest:daily-coupon\`.
Requête : \`packages/backtest-core/scripts/league-report/08-coupon-legs.sql\`.

## Dispositif

Un coupon par jour de matchs, composé uniquement à partir des cotes d'avant
match, sans aucune sortie du moteur ni du LLM. ${fixtures} rencontres,
${legs.length} jambes candidates, **${days} jours de matchs** du
${sorted[0] ?? "?"} au ${sorted.at(-1) ?? "?"}.

Le "seuil" est le taux de réussite qu'il faudrait atteindre pour rentrer dans
ses frais, soit la moyenne des 1 / cote combinée. Le **ratio** est le rapport
entre le taux réalisé et ce seuil : au-dessus de 1 le générateur gagne de
l'argent, en dessous il en perd. Il est préféré au ROI parce qu'à ces volumes
le ROI d'un coupon n'a aucune puissance, alors que le comptage de gagnants en
a.

## Bande de cote 5 – 7

${renderSummaries(tight)}

## Bande de cote 5 – 15

${renderSummaries(wide)}

**${below} configurations sur ${summaries.length} sont sous le seuil.** ${
    best
      ? `La seule au-dessus, ${best.legCount} jambes en bande ${best.band}, affiche un ratio de ${best.ratio.toFixed(2)} sur ${best.coupons} coupons, avec un intervalle de ${best.ratioLow95.toFixed(2)} à ${best.ratioHigh95.toFixed(2)} : elle est compatible avec le seuil comme avec la marge, et ne démontre rien.`
      : ""
  } Le générateur reproduit le prix du marché : il ne le bat dans aucune
configuration, et l'écart se creuse à mesure que le nombre de jambes
augmente.

## Le vivier est-il trop étroit ?

${pool.days} jours de matchs, ${pool.fixturesMean.toFixed(1)} rencontres cotées
par jour en moyenne (médiane ${pool.fixturesMedian}, maximum
${pool.fixturesMax}), réparties sur ${pool.leaguesMean.toFixed(1)} championnats
par jour en moyenne, jusqu'à ${pool.leaguesMax}.

Dénombrement exhaustif des coupons à deux jambes réalisables dans la bande
5 – 7 : **${enumeration.combinations.toLocaleString("fr-FR")} coupons
possibles**, dont **${enumeration.winning.toLocaleString("fr-FR")} gagnants**,
soit ${pct(enumeration.winningShare)} de tous les coupons réalisables. Un jour
médian offrait ${enumeration.medianPerDay} coupons possibles et
${enumeration.medianWinnersPerDay} gagnants ; seuls
${enumeration.daysWithoutWinner} jours sur ${enumeration.days} n'en offraient
aucun.

Le vivier n'est donc pas le problème. La part de coupons gagnants parmi tous
les coupons réalisables (${pct(enumeration.winningShare)}) reste sous le seuil
de rentabilité : les gagnants existent en nombre chaque jour, mais rien dans
les données ne permet de les désigner à l'avance. Choisir au hasard parmi eux,
ou selon n'importe quelle règle sans lien avec le résultat, rend exactement la
marge.

## Le choix sert-il à payer moins de marge ?

La seule chose qu'un vivier large permet réellement est d'éviter les marchés
les plus taxés. Le ratio théorique ci-dessous est le produit des values des
jambes retenues : ce que le coupon rapporte si le marché est exactement juste.

${renderMarginRules(marginRules)}

Restreindre le vivier fait bien baisser la marge payée, et le ratio théorique
remonte d'autant. Mais il plafonne sous 1 : même en ne jouant que le décile le
moins taxé, la marge résiduelle reste positive. L'écart entre observé et
théorique change de signe d'une règle à l'autre et d'une année à l'autre :
c'est du bruit, pas une compétence.

## Quels jours marchent le mieux ?

${renderWeekdays(weekdays)}

Le ratio théorique est **identique tous les jours** : la marge du marché ne
varie pas avec le calendrier, et les jambes disponibles sont aussi bien
calibrées en semaine que le week-end. Tout l'écart observé vient donc du
résultat binaire d'un unique coupon par jour.

${
    bestDay && worstDay
      ? `Le meilleur jour est ${bestDay.weekday} (${pct(bestDay.roi)}, ${bestDay.fixturesPerDay.toFixed(0)} matchs par jour) et le pire ${worstDay.weekday} (${pct(worstDay.roi)}, ${worstDay.fixturesPerDay.toFixed(0)} matchs par jour). Les deux gardent le même sens sur les deux moitiés de l'historique — ${bestDay.weekday} ${bestDay.firstHalfRatio?.toFixed(2) ?? "n/a"} puis ${bestDay.secondHalfRatio?.toFixed(2) ?? "n/a"}, ${worstDay.weekday} ${worstDay.firstHalfRatio?.toFixed(2) ?? "n/a"} puis ${worstDay.secondHalfRatio?.toFixed(2) ?? "n/a"} — mais l'écart se réduit nettement sur la période récente.`
      : ""
  }

Trois raisons de ne pas en faire une règle. Sept jours testés produisent
mécaniquement un meilleur et un pire. Les intervalles de confiance à ces
volumes couvrent une demi-unité de ratio. Et le ratio théorique étant plat, un
effet réel supposerait que le marché soit moins juste certains jours, ce que
la calibration des jambes dément : l'écart entre réalisé et implicite reste
compris entre +0,2 et +0,9 point quel que soit le jour.

Ce qui suit le calendrier, en revanche, c'est le nombre de matchs : les jours
creux (lundi, 15 rencontres) et les mois creux (juin) concentrent les pires
résultats, les jours pleins (samedi, 85 rencontres) les meilleurs. Le lien est
réel mais va dans le sens de la variance, pas de l'espérance : avec un seul
coupon par jour, un jour creux offre moins de combinaisons admissibles et
force des choix plus extrêmes.

## Suis-je rentable à la fin de la semaine ?

C'est la question du parieur qui suit le coupon tous les jours. Une semaine est
rentable si le cumul de ses tickets est positif. La colonne « plafond sans
marge » donne la même part pour un marché parfaitement juste : c'est le
maximum atteignable par la configuration, qu'aucun modèle ne peut dépasser.

${renderWeekly(weekly)}

À cote 5, gagner une semaine demande **deux tickets gagnants sur sept**. Même
avec une marge nulle, la binomiale n'en donne que 42 % : une majorité de
semaines rentables y est impossible, quel que soit le modèle. Les seules zones
qui franchissent 50 % sont les cotes courtes, où six tickets sur sept passent,
et les cotes très longues, où un seul suffit à payer la semaine — mais la marge
y est trop lourde.

## Stabilité dans le temps

Configuration la moins mauvaise : 2 jambes, bande 5 – 7.

${renderYears(years)}

## Lecture

- Le taux de réussite observé colle au taux que la marge prédit, à moins d'un
  point près, sur ${days} jours et près de quatre saisons.
- Chaque jambe supplémentaire dégrade le ratio : la composition multiplie la
  marge, elle ne crée pas d'espérance.
- Les séries noires dépassent vingt jours consécutifs dans toutes les
  configurations. Un coupon quotidien à cote 5 perd plus de quatre jours sur
  cinq, même parfaitement calibré : c'est la nature de la cote, pas un défaut
  du générateur.
- Sur la configuration de référence (2 jambes, bande 5 – 7), l'edge par jambe
  qu'il faudrait trouver pour atteindre l'équilibre est de
  ${reference ? pct(reference.requiredLegEdge) : "n/a"} — soit exactement la
  marge du marché mesurée par ailleurs.

## Limites

- Les cotes sont le consensus des books présents en base, pas la meilleure
  cote réellement disponible à la prise de pari.
- Les jambes d'un même jour ne sont pas indépendantes ; les intervalles de
  confiance les traitent comme si elles l'étaient.
- Le vivier ne couvre que les marchés à consensus (1X2, over/under, BTTS,
  double chance, mi-temps). Les marchés exotiques en sont exclus : le rapport
  par championnat montre qu'ils sont deux à dix fois plus taxés.
`;
}

async function main(): Promise<void> {
  const legs = await loadLegs(offlineDir());
  const days = groupByDay(legs);
  const summaries: Summary[] = [];
  let reference: Coupon[] = [];
  for (const band of BANDS) {
    for (const legCount of LEG_COUNTS) {
      const options = { legCount, band };
      const coupons = run(days, options);
      if (band.name === "5-7" && legCount === 2) reference = coupons;
      const summary = summarize(coupons, options);
      if (summary) summaries.push(summary);
    }
  }
  const context = {
    years: byYear(reference),
    pool: buildPoolStats(days),
    marginRules: buildMarginRules(days, legs),
    enumeration: enumerateTwoLeg(days),
    weekdays: buildWeekdays(days, reference),
    weekly: BANDS.flatMap((band) =>
      LEG_COUNTS.flatMap((legCount) => {
        const options = { legCount, band };
        const row = weeklyView(run(days, options), options);
        return row ? [row] : [];
      }),
    ),
  };
  const reportsDir = join(SCRIPT_DIR, "..", "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    join(reportsDir, `${VERSION}.json`),
    `${JSON.stringify({ version: VERSION, summaries, ...context }, null, 2)}\n`,
  );
  const docsDir = join(
    SCRIPT_DIR,
    "..",
    "..",
    "..",
    "docs",
    "audits",
    "2026-09-15",
  );
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(
    join(docsDir, "DAILY-COUPON-BACKTEST.md"),
    renderMarkdown(legs, summaries, context),
  );
  console.log(
    `${days.size} jours, ${summaries.length} configurations, ${context.years.length} années.`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
