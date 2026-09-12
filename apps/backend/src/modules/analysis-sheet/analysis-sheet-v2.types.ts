// Schéma v2 de la fiche d'analyse — CONTRAT PUBLIC.
//
// Principe directeur (validé 2026-09-12) : la fiche est un instrument de
// DIAGNOSTIC. Elle expose les données brutes qui permettent de vérifier une
// probabilité du modèle contre la réalité observée ; elle ne sélectionne
// jamais, ne classe jamais, n'invente jamais. Toute valeur absente est `null`
// accompagnée d'un `reason` — aucune imputation silencieuse.
//
// v2 est strictement ADDITIF : tous les champs v1 (AnalysisSheetJson dans
// analysis-sheet.render.ts) sont conservés à l'identique. Les scripts qui
// lisent la v1 continuent de fonctionner sans changement.
//
// Toutes les statistiques de `context` sont calculées à partir de matchs
// ANTÉRIEURS au coup d'envoi du match décrit (point-in-time safe) — voir
// analysis-sheet-v2.repository.ts, qui borne chaque requête sur
// `scheduledAt < kickoff`.

// ─────────────────────────────────────────────────────────────────────────────
// Raisons d'absence — vocabulaire fermé, pour qu'un consommateur puisse
// distinguer « donnée jamais collectée » de « échantillon trop court ».
// ─────────────────────────────────────────────────────────────────────────────

export const ABSENCE_REASONS = {
  /** Aucun match antérieur en base pour cette équipe dans la fenêtre demandée. */
  NO_PRIOR_FIXTURES: 'no_prior_fixtures',
  /** Des matchs existent, mais aucun ne porte la donnée (ex. xG absent partout). */
  NO_DATA_IN_SAMPLE: 'no_data_in_sample',
  /** Échantillon sous le minimum requis pour que l'agrégat ait un sens. */
  SAMPLE_TOO_SMALL: 'sample_too_small',
  /** La donnée n'est pas collectée par l'ETL aujourd'hui. */
  NOT_COLLECTED: 'not_collected',
  /** Aucune cote en base pour ce marché sur ce match. */
  NO_ODDS: 'no_odds',
  /** Un seul snapshot de cotes : aucun mouvement calculable. */
  SINGLE_SNAPSHOT: 'single_snapshot',
  /**
   * Les issues complémentaires du marché ne sont pas cotées, donc la marge du
   * bookmaker n'est pas estimable. Cas de TO_WIN_EITHER_HALF : « domicile
   * gagne une mi-temps » et « extérieur gagne une mi-temps » ne forment pas une
   * partition (les deux peuvent arriver, ou aucune), et le complément de
   * chacune n'est pas proposé.
   */
  NO_COMPLEMENT_PRICED: 'no_complement_priced',
  /** La provenance de la donnée n'a pas été enregistrée à l'époque. */
  PROVENANCE_NOT_RECORDED: 'provenance_not_recorded',
  /** Le ModelRun est antérieur à l'ajout de ce champ dans features. */
  PREDATES_FIELD: 'predates_field',
} as const;

export type AbsenceReason =
  (typeof ABSENCE_REASONS)[keyof typeof ABSENCE_REASONS];

/** Valeur absente explicitement motivée. Jamais un `null` nu. */
export type Absent = { value: null; reason: AbsenceReason };

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — context.form
// ─────────────────────────────────────────────────────────────────────────────

/** Bilan sur une fenêtre de N matchs, toutes compétitions confondues. */
export type FormWindow = {
  /** Taille de fenêtre demandée (5 ou 10). */
  window: number;
  /** Nombre de matchs réellement disponibles — peut être < window. */
  sampleSize: number;
  /** Série W/D/L du plus récent au plus ancien, ex. "WWDLW". */
  sequence: string;
  wins: number;
  draws: number;
  losses: number;
  /** 3 points par victoire, 1 par nul — non normalisé. */
  points: number;
  /** Points rapportés au maximum possible (3 × sampleSize). null si sampleSize = 0. */
  pointsPerMatch: number | null;
  goalsFor: number;
  goalsAgainst: number;
  goalsForPerMatch: number | null;
  goalsAgainstPerMatch: number | null;
};

export type TeamForm = {
  /** 5 derniers matchs, toutes compétitions. */
  last5: FormWindow;
  /** 10 derniers matchs, toutes compétitions. */
  last10: FormWindow;
  /**
   * 5 derniers matchs joués DANS LE MÊME RÔLE que dans le match décrit :
   * domicile pour l'équipe à domicile, extérieur pour l'équipe à l'extérieur.
   */
  last5SameVenue: FormWindow;
  /** "HOME" | "AWAY" — le rôle auquel se rapporte last5SameVenue. */
  venue: 'HOME' | 'AWAY';
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — context.goals (saison en cours et saison précédente)
// ─────────────────────────────────────────────────────────────────────────────

/** Agrégats de buts sur un sous-ensemble de matchs (tous / domicile / extérieur). */
export type GoalsSplit = {
  sampleSize: number;
  goalsForPerMatch: number | null;
  goalsAgainstPerMatch: number | null;
  /** Part des matchs à 2 buts ou plus, toutes équipes confondues. */
  over15Rate: number | null;
  /** Part des matchs à 3 buts ou plus. */
  over25Rate: number | null;
  /** Part des matchs où les deux équipes ont marqué. */
  bttsRate: number | null;
  /** Part des matchs où l'équipe n'a rien encaissé. */
  cleanSheetRate: number | null;
  /** Part des matchs où l'équipe n'a pas marqué. */
  failedToScoreRate: number | null;
  /**
   * Part des matchs où l'équipe a gagné AU MOINS UNE mi-temps, calculé depuis
   * les scores à la mi-temps : 1re MT = score HT, 2e MT = score final − score HT.
   * null si aucun match de l'échantillon ne porte de score à la mi-temps.
   */
  winEitherHalfRate: number | null;
  /** Matchs de l'échantillon disposant d'un score à la mi-temps exploitable. */
  halfTimeSampleSize: number;
};

export type SeasonGoals = {
  /** Nom de la saison tel qu'en base, ex. "2026-27". null si non résolue. */
  seasonName: string | null;
  all: GoalsSplit;
  home: GoalsSplit;
  away: GoalsSplit;
};

export type TeamGoals = {
  currentSeason: SeasonGoals | Absent;
  previousSeason: SeasonGoals | Absent;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — context.xg
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ Avertissement de provenance (audit 2026-09-12, docs/audit-fiche-v2-2026-09-12.md
 * §2.2). La colonne `fixture.homeXg/awayXg` a reçu, selon les périodes et les
 * matchs, soit le xG réel d'API-Football, soit un proxy `tirs cadrés × 0.4`
 * (XG_SHOTS_PROXY_FACTOR) — sans qu'aucune colonne n'enregistre lequel.
 * Tant que la migration `xgSource` n'a pas tourné, `source` vaut
 * `"unverifiable"` : c'est une information honnête, pas une imputation.
 */
export type XgSource = 'api_football' | 'shots_proxy' | 'unverifiable';

export type TeamXg = {
  /** Fenêtre demandée (N derniers matchs). */
  window: number;
  /** Matchs de la fenêtre portant effectivement une valeur de xG. */
  matchesWithXg: number;
  xgForPerMatch: number | null;
  xgAgainstPerMatch: number | null;
  source: XgSource;
  /** Renseigné dès que `source` n'est pas déterminable ou que les xG manquent. */
  reason: AbsenceReason | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — context.standing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Classement DÉRIVÉ des matchs terminés de la saison, arrêté à la veille du
 * coup d'envoi (point-in-time safe). La table `standing` d'API-Football n'est
 * plus alimentée depuis 2026-07-19 (48 lignes, 1 ligue) — voir l'audit §2.4.
 *
 * ⚠ Limite assumée : les retraits de points administratifs ne sont pas
 * reflétés, `source` le signale explicitement.
 */
export type TeamStanding = {
  source: 'derived_from_fixtures';
  /** Rang dans la compétition parmi les équipes ayant joué au moins un match. */
  rank: number;
  /** Nombre d'équipes classées — donne son sens au rang. */
  teamCount: number;
  points: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalsDiff: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — context.schedule
// ─────────────────────────────────────────────────────────────────────────────

export type TeamSchedule = {
  /** Jours pleins écoulés depuis le dernier match terminé. null si aucun. */
  restDays: number | null;
  /** Date du dernier match terminé (ISO). */
  lastMatchAt: string | null;
  /** Compétition du dernier match — repère un retour de coupe/Europe. */
  lastMatchCompetitionCode: string | null;
  /** Matchs programmés dans les 4 jours SUIVANT le coup d'envoi. */
  fixturesNext4Days: number;
  /** Matchs joués dans les 4 jours PRÉCÉDANT le coup d'envoi. */
  fixturesPrev4Days: number;
  /**
   * Un match dans une compétition autre que le championnat du match décrit,
   * dans la fenêtre ±4 jours (coupe nationale ou compétition européenne).
   * null si aucune autre compétition n'est couverte pour cette équipe.
   */
  otherCompetitionWithin4Days: {
    competitionCode: string;
    scheduledAt: string;
    /** Avant ou après le match décrit. */
    side: 'BEFORE' | 'AFTER';
  } | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — context.availability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ⚠ EVCore ne stocke AUCUN détail joueur. `ModelRun.features.shadow_injuries`
 * ne contient que des compteurs, renseignés sur ~19 % des runs, et
 * `shadow_lineups` est null sur 100 % des lignes (audit §2.6). Les suspensions
 * ne sont pas fournies par le flux. Ce bloc expose donc ce qui existe, et rien
 * de plus — il ne permet pas d'identifier « les blessés clés ».
 */
export type TeamAvailability = {
  /** Nombre de joueurs signalés blessés/absents par API-Football. */
  injuryCount: number | null;
  /** Renseigné quand injuryCount est null. */
  reason: AbsenceReason | null;
  /** Détail par joueur — jamais disponible aujourd'hui, réservé. */
  players: null;
  playersReason: AbsenceReason;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — context, par équipe puis par match
// ─────────────────────────────────────────────────────────────────────────────

export type TeamContext = {
  teamId: string;
  teamName: string;
  form: TeamForm;
  goals: TeamGoals;
  xg: TeamXg;
  standing: TeamStanding | Absent;
  schedule: TeamSchedule;
  availability: TeamAvailability;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.1 — h2h (niveau match)
// ─────────────────────────────────────────────────────────────────────────────

export type H2HMeeting = {
  fixtureId: string;
  date: string;
  competitionCode: string;
  competitionName: string;
  /**
   * Lieu, du point de vue de l'équipe à domicile DU MATCH DÉCRIT :
   * "HOME" si elle recevait déjà, "AWAY" si les rôles étaient inversés.
   */
  venueForHomeTeam: 'HOME' | 'AWAY';
  /** Score final, orienté (buts de l'équipe à domicile du match décrit d'abord). */
  score: { homeTeam: number; awayTeam: number };
  /** Score à la mi-temps, même orientation. null si non collecté. */
  halfTimeScore: { homeTeam: number; awayTeam: number } | null;
};

export type H2HAggregates = {
  sampleSize: number;
  /** Victoires de l'équipe à domicile DU MATCH DÉCRIT, tous lieux confondus. */
  homeTeamWins: number;
  draws: number;
  awayTeamWins: number;
  goalsPerMatch: number | null;
  over15Rate: number | null;
  over25Rate: number | null;
  bttsRate: number | null;
};

/**
 * Le scalaire historique `model.shadowSignals.h2h`, rendu vérifiable :
 * la formule, ses paramètres, et l'identité du favori sur lequel il porte.
 */
export type H2HScoreExplanation = {
  /** Valeur telle que stockée dans ModelRun.features.shadow_h2h. */
  value: number | null;
  reason: AbsenceReason | null;
  /** Équipe considérée comme favorite au moment du calcul. */
  favorite: 'HOME' | 'AWAY' | null;
  /** Nombre de confrontations réellement utilisées (LIMIT côté moteur). */
  sampleSize: number | null;
  /** Minimum requis pour que le score soit calculé. */
  minSample: number;
  /** Facteur de décroissance appliqué au rang i : weight = decay^i. */
  decay: number;
  /** Score attribué à un match nul. */
  drawScore: number;
  formula: string;
  interpretation: string;
};

export type H2HBlock = {
  /** Jusqu'à 10 dernières confrontations, de la plus récente à la plus ancienne. */
  meetings: H2HMeeting[];
  aggregates: H2HAggregates;
  score: H2HScoreExplanation;
};

export type FixtureContext = {
  home: TeamContext;
  away: TeamContext;
  h2h: H2HBlock;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.2 — market (7 marchés cibles)
// ─────────────────────────────────────────────────────────────────────────────

/** Les 7 marchés cibles du combiné, identifiés par (market, pick) en base. */
export const TARGET_MARKETS = [
  { key: 'HOME', market: 'ONE_X_TWO', pick: 'HOME' },
  { key: 'AWAY', market: 'ONE_X_TWO', pick: 'AWAY' },
  { key: 'WIN_EITHER_HALF_HOME', market: 'TO_WIN_EITHER_HALF', pick: 'HOME' },
  { key: 'WIN_EITHER_HALF_AWAY', market: 'TO_WIN_EITHER_HALF', pick: 'AWAY' },
  { key: 'BTTS_YES', market: 'BTTS', pick: 'YES' },
  { key: 'OVER_1_5', market: 'OVER_UNDER', pick: 'OVER_1_5' },
  { key: 'OVER_2_5', market: 'OVER_UNDER', pick: 'OVER' },
] as const;

export type TargetMarketKey = (typeof TARGET_MARKETS)[number]['key'];

/**
 * Probabilité implicite du marché, sous deux formes.
 *
 * `raw` = 1/cote, marge du bookmaker INCLUSE. C'est la convention utilisée
 * partout ailleurs dans le moteur (AVOID, market-coherence) — ne pas la
 * confondre avec une probabilité réelle.
 *
 * `deVigged` = marge retirée par normalisation proportionnelle sur l'ensemble
 * des issues du marché. Méthode choisie pour sa transparence : avec 1 à 4
 * bookmakers seulement, Shin ou la méthode logarithmique ne sont pas
 * estimables de façon stable. Limite connue : la normalisation proportionnelle
 * sous-corrige les favoris (biais favori-outsider).
 */
export type ImpliedProbability = {
  raw: number | null;
  deVigged: number | null;
  /** Méthode de retrait de marge, pour que le calcul soit reproductible. */
  method: 'proportional' | null;
  /** Somme des probabilités brutes des issues du marché (1 = marge nulle). */
  overround: number | null;
  /** Issues utilisées pour la normalisation, ex. ["HOME","DRAW","AWAY"]. */
  outcomes: string[] | null;
  reason: AbsenceReason | null;
};

/**
 * Mouvement de ligne réel, ancré sur le PREMIER snapshot réellement disponible.
 *
 * ⚠ Ce n'est pas une « cote d'ouverture » de marché : l'ETL ne collecte les
 * cotes qu'à partir de J+3 (ODDS_PREMATCH_HORIZON_DAYS = 3), donc l'ancrage est
 * typiquement à ~72 h du coup d'envoi. Le champ `baselineHoursBeforeKickoff` dit
 * exactement de quand date la référence — à lire avant d'interpréter le delta.
 *
 * Le signal `model.shadowSignals.lineMovement` de la v1, lui, exige un snapshot
 * antérieur à KO−7 j et reste donc null sur ~99,5 % des matchs : il est conservé
 * tel quel pour non-régression, ce bloc est sa version exploitable.
 */
export type LineMovement = {
  /** Première cote observée (tous bookmakers confondus, meilleure cote). */
  firstOdds: number | null;
  firstSnapshotAt: string | null;
  baselineHoursBeforeKickoff: number | null;
  /** Dernière cote observée (meilleure cote). */
  latestOdds: number | null;
  latestSnapshotAt: string | null;
  /** (first − latest) / first. Positif = la cote a raccourci (argent sur cette issue). */
  movement: number | null;
  /** Nombre de snapshots distincts entre les deux bornes. */
  snapshotCount: number;
  reason: AbsenceReason | null;
};

export type MarketQuote = {
  key: TargetMarketKey;
  market: string;
  pick: string;
  /** Libellé français, même source que le reste de la fiche (pickLabel). */
  label: string;
  /** Meilleure cote disponible au dernier snapshot. */
  bestOdds: number | null;
  bestBookmaker: string | null;
  /** Cote médiane au dernier snapshot, sur les bookmakers ayant coté. */
  medianOdds: number | null;
  bookmakerCount: number;
  /** Horodatage du snapshot utilisé pour bestOdds/medianOdds. */
  snapshotAt: string | null;
  implied: ImpliedProbability;
  lineMovement: LineMovement;
  reason: AbsenceReason | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.3 — traçabilité du modèle
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Une étape d'ajustement dans la chaîne qui mène du λ brut aux probabilités
 * publiées. `applied: false` signifie que l'étape était inactive pour ce match
 * (drapeau coupé, ou condition d'entrée non remplie) — pas qu'elle a un effet nul.
 */
export type LambdaTraceStep = {
  /** Identifiant stable de l'étape, ex. "h2h_lambda_correction". */
  name: string;
  /** Ce sur quoi l'étape agit : le λ lui-même, ou les probabilités dérivées. */
  target: 'lambda' | 'probabilities';
  applied: boolean;
  /** Delta sur λ (home/away) quand target = "lambda". */
  lambdaDelta: { home: number; away: number } | null;
  /** Entrée qui pilote l'étape, ex. le score H2H ou le score de congestion. */
  input: number | null;
  /** Raison lisible : pourquoi l'étape a (ou n'a pas) été appliquée. */
  reason: string;
};

/**
 * Reconstruction complète du λ. Critère d'acceptation : λ final doit être
 * reconstructible en appliquant les `steps` dans l'ordre au `base`.
 */
export type LambdaTrace = {
  /** λ issu de deriveLambdas, avant toute correction. null si non reconstructible. */
  base: { home: number; away: number } | null;
  /** Entrées de deriveLambdas, telles que lues dans TeamStats. */
  inputs: {
    homeXgFor: number | null;
    homeXgAgainst: number | null;
    awayXgFor: number | null;
    awayXgAgainst: number | null;
    /** Paramètres de ligue appliqués (buildLambdaConfig). */
    meanLambda: number | null;
    homeAdvFactor: number | null;
    awayDisadvFactor: number | null;
    lambdaScale: number | null;
    shrinkageFactor: number | null;
  };
  /** Formule textuelle de deriveLambdas, pour vérification à la main. */
  formula: string;
  steps: LambdaTraceStep[];
  /** λ publié (ModelRun.features.lambdaHome/lambdaAway). */
  final: { home: number; away: number; total: number } | null;
  /** Vrai si λ a touché le plancher MIN_LAMBDA — le reste est alors peu fiable. */
  floorHit: boolean | null;
  /**
   * Comment `base` a été obtenu. Le moteur ne persiste que le λ FINAL : le λ de
   * base est reconstruit en inversant l'unique étape qui agit sur λ (la
   * correction H2H), qui est exactement inversible hors saturation.
   */
  baseDerivation: 'inverted_from_final' | 'final_is_base' | 'unavailable';
  /** Limites de la reconstruction, énoncées plutôt que masquées. */
  notes: string[];
  reason: AbsenceReason | null;
};

/** Une composante de dataCoverage, avec son poids explicite. */
export type DataCoverageComponent = {
  name: 'lineMovement' | 'h2h' | 'congestion';
  present: boolean;
  /** Poids dans le ratio — égal pour les trois aujourd'hui (1/3). */
  weight: number;
  value: number | null;
  /** Pourquoi la composante est absente. */
  reason: AbsenceReason | null;
};

export type DataCoverageDetail = {
  /** Identique au `model.dataCoverage` v1 — conservé pour non-régression. */
  ratio: number;
  /**
   * Nombre entier de composantes présentes (0 à 3). À utiliser pour filtrer :
   * `ratio` vaut 2/3 = 0.6666… et un filtre `>= 0.67` élimine tout.
   */
  level: number;
  /** Nombre total de composantes — dénominateur de `level`. */
  maxLevel: number;
  components: DataCoverageComponent[];
};

/**
 * Un des 7 marchés cibles, TOUJOURS présent, même rejeté, même non coté.
 *
 * `rejectionReason` et `gates` sont du DIAGNOSTIC : ils disent ce que le moteur
 * de pari simple aurait fait, ils ne filtrent rien ici. Un marché rejeté reste
 * exposé avec toutes ses valeurs.
 */
export type TargetMarketEvaluation = {
  key: TargetMarketKey;
  market: string;
  pick: string;
  label: string;
  /** Probabilité publiée par le modèle (après tous les ajustements). */
  modelProbability: number | null;
  /** Probabilité Poisson brute, avant ajustements. */
  rawModelProbability: number | null;
  /** modelProbability − rawModelProbability. Détail dans lambdaTrace. */
  adjustmentDelta: number | null;
  /** Probabilité implicite du marché (brute et dé-marginalisée). */
  marketProbability: ImpliedProbability;
  /**
   * modelProbability − marketProbability.raw.
   *
   * ⚠ L'edge annoncé est ANTI-PRÉDICTIF sur nos données (audit 2026-08-22 :
   * taux réalisé plat 0,511 → 0,375 quand l'edge annoncé monte 0,481 → 0,699).
   * Exposé comme diagnostic. Ne jamais trier dessus.
   */
  edge: number | null;
  odds: number | null;
  /** EV = (probabilité × cote) − 1. */
  ev: number | null;
  /** "viable" | "rejected" tel que le moteur de pari simple l'a jugé. */
  status: 'viable' | 'rejected' | 'not_evaluated';
  rejectionReason: string | null;
  /** Les seuils qui s'appliquaient, pour comprendre un rejet sans lire le code. */
  gates: {
    /** Plancher d'EV effectif pour ce (ligue, marché, pick). */
    evFloor: number | null;
    /**
     * Plancher de cote effectif. ⚠ `odds_below_floor` n'est PAS un plancher
     * absolu : c'est un plancher par (ligue × marché × pick) issu des backtests
     * ROI, qui peut monter à 5.00 (ex. CH|ONE_X_TWO|HOME). Une cote de 3.47
     * rejetée par ce motif est donc cohérente.
     */
    minOdds: number | null;
    maxOdds: number | null;
    /** Plancher de probabilité directionnelle. */
    minProbability: number | null;
    /**
     * Ce couple (ligue × marché × pick) est-il volontairement désactivé.
     *
     * Le moteur coupe un segment en lui donnant un plancher d'EV inatteignable
     * (0.99 ou 2.99 dans ev.constants.ts — 104 segments au total). C'est
     * rigoureusement inatteignable : `EV_HARD_CAP = 0.90` rejette tout pick
     * au-dessus de 0.90 avant même que le plancher ne soit testé. Sans ce
     * drapeau, un plancher de 2.99 se lit comme un seuil ordinaire alors qu'il
     * signifie « ce marché ne sortira jamais dans cette ligue ».
     */
    segmentDisabled: boolean;
  };
  reason: AbsenceReason | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.4 — calibration (global, hors observationOnly)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fiabilité historique d'un couple (marché × compétition), sur tout
 * l'historique réglé.
 *
 * ⚠ `roi` est exposé parce qu'il est demandé, mais il n'a AUCUNE puissance
 * statistique à nos volumes (erreur-type 13–18 points pour des écarts de 10
 * points — audit 2026-08-22). La mesure exploitable est `calibrationRatio` :
 * fréquence observée ÷ probabilité moyenne annoncée. 1,0 = calibré, < 1 = le
 * modèle sur-annonce. C'est elle qui doit piloter une décision, jamais le ROI.
 */
export type CalibrationCell = {
  market: string;
  competitionCode: string;
  competitionName: string;
  /** Nombre de sélections réglées (WON + LOST), hors VOID et hors observation. */
  n: number;
  wins: number;
  losses: number;
  hitRate: number | null;
  /** Probabilité moyenne annoncée par le modèle. */
  avgPredictedProbability: number | null;
  /** Fréquence réellement observée — à comparer à la ligne précédente. */
  observedFrequency: number | null;
  /** observedFrequency ÷ avgPredictedProbability. */
  calibrationRatio: number | null;
  /** Score de Brier : moyenne de (probabilité − résultat)². Plus bas = mieux. */
  brierScore: number | null;
  /** À mise unitaire. Exposé par complétude — voir l'avertissement ci-dessus. */
  roi: number | null;
};

/** Biais du λ par compétition : ce que le modèle prédit vs ce qui s'est produit. */
export type LambdaBiasCell = {
  competitionCode: string;
  competitionName: string;
  n: number;
  /** Moyenne de (λ_home + λ_away) sur les matchs réglés. */
  avgPredictedGoals: number | null;
  /** Moyenne des buts réellement marqués. */
  avgActualGoals: number | null;
  /** prédit − réel. Positif = le modèle sur-estime le nombre de buts. */
  bias: number | null;
  /** Ratio réel ÷ prédit — la forme directement utilisable comme LAMBDA_SCALE. */
  ratio: number | null;
};

export type CalibrationBlock = {
  /** Fenêtre couverte par l'agrégat — c'est tout l'historique réglé. */
  settledThrough: string | null;
  /** Sélections réglées prises en compte, après exclusion des observationOnly. */
  totalSettled: number;
  /** Ce qui a été exclu et pourquoi — pour que le périmètre soit vérifiable. */
  exclusions: {
    observationOnly: number;
    voided: number;
    withoutOdds: number;
  };
  byMarketAndCompetition: CalibrationCell[];
  lambdaBiasByCompetition: LambdaBiasCell[];
};

// ─────────────────────────────────────────────────────────────────────────────
// 2.5 — legPool
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filtres appliqués au legPool. Purement DÉCLARATIFS : ils restreignent la
 * liste, ils ne la classent pas et n'y ajoutent aucun score. La sélection se
 * fait en aval — la fiche ne compose jamais de combiné.
 */
export type LegPoolFilters = {
  minOdds: number;
  markets: TargetMarketKey[];
  minCoverage: number;
  excludeFlags: boolean;
  status: string;
};

export type LegPoolEntry = {
  fixtureId: string;
  kickoff: string;
  match: string;
  competitionCode: string;
  key: TargetMarketKey;
  market: string;
  pick: string;
  label: string;
  modelProbability: number | null;
  marketProbability: number | null;
  odds: number | null;
  ev: number | null;
  edge: number | null;
  /**
   * Le fixtureId. Deux sélections partageant ce groupe portent sur le même
   * match : elles sont corrélées et ne doivent jamais être combinées.
   */
  correlationGroup: string;
  /** Fiabilité historique du couple (marché × compétition), tirée de `calibration`. */
  reliability: {
    n: number;
    calibrationRatio: number | null;
    brierScore: number | null;
    hitRate: number | null;
    /** null quand aucune cellule de calibration ne couvre ce couple. */
    reason: AbsenceReason | null;
  };
  /** Niveau de couverture des signaux (0-3), repris de dataCoverageDetail. */
  coverageLevel: number;
  /** Drapeaux actifs sur le match — informatifs, le filtre les gère à part. */
  flags: {
    avoid: boolean;
    calibrationAlert: boolean;
    calibrationAlertOverUnder: boolean;
  };
};

export type LegPool = {
  filters: LegPoolFilters;
  /** Sélections retenues, dans l'ordre chronologique des coups d'envoi. */
  entries: LegPoolEntry[];
  /** Combien de sélections chaque filtre a écartées — pour auditer le filtrage. */
  excludedCounts: Record<string, number>;
};

// ─────────────────────────────────────────────────────────────────────────────
// meta.definitions — unités et fenêtres, pour que la fiche s'auto-documente
// ─────────────────────────────────────────────────────────────────────────────

export type SheetDefinition = {
  /** Chemin du champ décrit, ex. "context.home.form.last5". */
  path: string;
  /** Unité ou domaine : "probability [0,1]", "goals/match", "days"… */
  unit: string;
  /** Fenêtre de calcul quand elle s'applique. */
  window: string | null;
  description: string;
};

export type SheetMetaV2 = {
  definitions: SheetDefinition[];
  /** Constantes du moteur citées par la fiche, avec leur valeur effective. */
  constants: Record<string, number | string | boolean>;
  /** Limites connues, énoncées plutôt que masquées. */
  caveats: string[];
};
