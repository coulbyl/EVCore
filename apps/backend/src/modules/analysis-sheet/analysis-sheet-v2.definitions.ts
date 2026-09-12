// `meta.definitions` — la fiche s'auto-documente.
//
// Contrainte du cahier des charges : « unités et fenêtres explicites dans les
// noms ou dans un bloc meta.definitions ». Plutôt que d'allonger les noms de
// champs, on centralise ici l'unité, la fenêtre et la portée de chaque
// grandeur, ainsi que les constantes du moteur que la fiche cite.

import {
  AVOID_CONFIG,
  H2H_DECAY,
  H2H_MIN_SAMPLE,
  MAX_SELECTION_ODDS,
} from '@evcore/analysis-core';
import {
  CALIBRATION_GATE,
  EV_THRESHOLD,
  H2H_GAMMA,
  LAMBDA_SHRINKAGE_FACTOR,
  MIN_SELECTION_ODDS,
  OVER_UNDER_CALIBRATION_GATE,
} from '@modules/betting-engine/ev.constants';
import type { SheetDefinition, SheetMetaV2 } from './analysis-sheet-v2.types';

const DEFINITIONS: SheetDefinition[] = [
  {
    path: 'context.*.form.last5 / last10',
    unit: 'matchs, points (3/1/0), buts',
    window: '5 et 10 derniers matchs terminés, toutes compétitions',
    description:
      'Série W/D/L du plus récent au plus ancien. `sampleSize` dit combien de ' +
      'matchs existent réellement — il peut être inférieur à la fenêtre.',
  },
  {
    path: 'context.*.form.last5SameVenue',
    unit: 'matchs, points, buts',
    window: '5 derniers matchs dans le même rôle (domicile ou extérieur)',
    description:
      "Rôle pris dans le match décrit : domicile pour l'équipe qui reçoit, " +
      "extérieur pour l'autre.",
  },
  {
    path: 'context.*.goals.*.over15Rate / over25Rate',
    unit: 'probabilité [0,1]',
    window: 'saison concernée',
    description:
      'Part des matchs de l’équipe à 2 buts ou plus (over15) et 3 buts ou plus ' +
      '(over25), tous buts du match confondus — pas seulement les siens.',
  },
  {
    path: 'context.*.goals.*.winEitherHalfRate',
    unit: 'probabilité [0,1]',
    window: 'saison concernée, matchs disposant d’un score à la mi-temps',
    description:
      '1re mi-temps = score à la pause ; 2e mi-temps = score final − score à la ' +
      'pause. Rapporté à `halfTimeSampleSize`, pas à `sampleSize` : un score de ' +
      'mi-temps manquant est une inconnue, pas un échec.',
  },
  {
    path: 'context.*.xg',
    unit: 'buts attendus par match',
    window: '10 derniers matchs portant un xG',
    description:
      '⚠ `source` vaut "unverifiable" : la colonne fixture.homeXg contient soit ' +
      'le xG d’API-Football, soit un proxy tirs cadrés × 0.4, sans marqueur de ' +
      'provenance. Annoncer une source serait une affirmation non vérifiable.',
  },
  {
    path: 'context.*.standing',
    unit: 'rang, points, buts',
    window: 'saison en cours, arrêtée à la veille du coup d’envoi',
    description:
      'Dérivé des matchs terminés (la table standing n’est plus alimentée). ' +
      'Les retraits de points administratifs ne sont pas reflétés.',
  },
  {
    path: 'context.*.schedule.restDays',
    unit: 'jours pleins',
    window: 'depuis le dernier match terminé',
    description:
      'Différence entre le coup d’envoi et le dernier match joué, arrondie à ' +
      'l’entier inférieur.',
  },
  {
    path: 'context.h2h.meetings',
    unit: 'buts',
    window: '10 dernières confrontations antérieures au coup d’envoi',
    description:
      'Scores orientés du point de vue de l’équipe qui reçoit DANS LE MATCH ' +
      'DÉCRIT, quel que soit le lieu de la rencontre passée. `venueForHomeTeam` ' +
      'dit qui recevait ce jour-là.',
  },
  {
    path: 'context.h2h.score',
    unit: 'taux pondéré [0,1]',
    window: '5 dernières confrontations (minimum 3)',
    description:
      'Le scalaire model.shadowSignals.h2h. 0.5 = neutre. Formule et ' +
      'interprétation portées par l’objet lui-même.',
  },
  {
    path: 'market[].implied.raw',
    unit: 'probabilité [0,1]',
    window: 'dernier snapshot de cotes',
    description:
      '1/cote médiane, marge du bookmaker INCLUSE. C’est la convention du ' +
      'moteur (AVOID, market-coherence) — ce n’est pas une probabilité réelle.',
  },
  {
    path: 'market[].implied.deVigged',
    unit: 'probabilité [0,1]',
    window: 'dernier snapshot de cotes',
    description:
      'Marge retirée par normalisation proportionnelle sur les issues du ' +
      'marché. null pour TO_WIN_EITHER_HALF : HOME et AWAY n’y forment pas une ' +
      'partition et le complément n’est pas coté.',
  },
  {
    path: 'market[].lineMovement',
    unit: 'variation relative',
    window: 'du premier snapshot disponible au dernier',
    description:
      '(première − dernière) / première. Positif = la cote a raccourci. ' +
      '⚠ Ce n’est pas une cote d’ouverture : la collecte commence à J+3, donc ' +
      'l’ancrage est à ~72 h du coup d’envoi — lire baselineHoursBeforeKickoff.',
  },
  {
    path: 'lambdaTrace',
    unit: 'buts attendus (λ Poisson)',
    window: 'match',
    description:
      'λ de base, puis chaque ajustement dans l’ordre. Seule la correction H2H ' +
      'agit sur λ ; les quatre autres étapes agissent sur les probabilités. ' +
      'λ de base reconstruit en inversant la correction H2H (baseDerivation).',
  },
  {
    path: 'dataCoverageDetail.level',
    unit: 'entier 0-3',
    window: 'match',
    description:
      'Nombre de signaux présents. À utiliser pour filtrer plutôt que `ratio`, ' +
      'qui vaut 2/3 = 0.6666… et rend tout seuil ≥ 0.67 éliminatoire.',
  },
  {
    path: 'targetMarkets[].edge',
    unit: 'points de probabilité',
    window: 'match',
    description:
      '⚠ modelProbability − marketProbability.raw. Anti-prédictif sur nos ' +
      'données (audit 2026-08-22) : diagnostic uniquement, ne jamais trier ' +
      'dessus.',
  },
  {
    path: 'targetMarkets[].gates.minOdds',
    unit: 'cote décimale',
    window: '—',
    description:
      '⚠ `odds_below_floor` n’est PAS un plancher absolu : c’est un plancher ' +
      'par (ligue × marché × pick) issu des backtests ROI, qui monte jusqu’à ' +
      '5.00 (ex. CH|ONE_X_TWO|HOME). Une cote de 3.47 rejetée par ce motif est ' +
      'donc cohérente.',
  },
  {
    path: 'targetMarkets[].gates.segmentDisabled',
    unit: 'booléen',
    window: '—',
    description:
      'true = ce couple (ligue × marché × pick) est volontairement coupé par un ' +
      'plancher d’EV sentinelle (0.99 ou 2.99), inatteignable puisque ' +
      'EV_HARD_CAP vaut 0.90. 104 segments sont dans ce cas. À lire avant de ' +
      'conclure qu’un marché « ne sort jamais » dans une ligue.',
  },
  {
    path: 'calibration.byMarketAndCompetition[].calibrationRatio',
    unit: 'ratio',
    window: 'tout l’historique réglé',
    description:
      'Fréquence observée ÷ probabilité moyenne annoncée. 1 = calibré, < 1 = le ' +
      'modèle sur-annonce. C’est la mesure de fiabilité de référence.',
  },
  {
    path: 'calibration.byMarketAndCompetition[].roi',
    unit: 'mise unitaire',
    window: 'tout l’historique réglé',
    description:
      '⚠ Exposé par complétude, sans puissance statistique à nos volumes ' +
      '(erreur-type 13-18 points). Ne pas en tirer de conclusion.',
  },
  {
    path: 'legPool.entries[].correlationGroup',
    unit: 'identifiant',
    window: '—',
    description:
      'Le fixtureId. Deux sélections qui le partagent portent sur le même ' +
      'match : elles sont corrélées et ne doivent pas être combinées.',
  },
];

const CAVEATS = [
  'La fiche est un instrument de diagnostic : elle expose, elle ne sélectionne ' +
    'pas. Aucun champ n’ordonne les marchés par qualité.',
  'Toutes les statistiques de `context` sont calculées sur des matchs ' +
    'antérieurs au coup d’envoi — la borne est posée dans le SQL.',
  'Une valeur absente est toujours `null` accompagnée d’un `reason` : aucune ' +
    'imputation silencieuse.',
  'model.shadowSignals.lineMovement (v1) reste null sur ~99,5 % des matchs : il ' +
    'exige un snapshot antérieur à KO−7 jours alors que la collecte commence à ' +
    'J+3. Utiliser market[].lineMovement, qui est ancré sur le premier ' +
    'snapshot réellement disponible.',
  'context.availability ne contient que des compteurs de blessés, présents sur ' +
    '~19 % des analyses. Aucun détail joueur n’est stocké, et les suspensions ne ' +
    'sont pas fournies par le flux.',
  'context.*.xg.source vaut "unverifiable" tant que la migration xgSource n’a ' +
    'pas tourné : xG réel et proxy tirs cadrés partagent la même colonne.',
  'calibration.byMarketAndCompetition agrège des canaux de nature différente ' +
    'sur un même marché ; c’est une mesure de calibration du marché, pas d’un ' +
    'canal en particulier.',
  'Le calcul du biais λ parcourt tout l’historique des ModelRun (~8 s) : ' +
    'utiliser `includeCalibration=false` quand seul le contexte est nécessaire.',
  'Le bloc `context` est coupé au-delà de 7 jours de plage ' +
    '(ANALYSIS_SHEET_LIMITS.maxContextRangeDays) : la fiche reste servie, avec ' +
    'le motif dans `contextReason`.',
];

export function buildSheetMetaV2(): SheetMetaV2 {
  return {
    definitions: DEFINITIONS,
    constants: {
      EV_THRESHOLD: EV_THRESHOLD.toNumber(),
      MIN_SELECTION_ODDS: MIN_SELECTION_ODDS.toNumber(),
      MAX_SELECTION_ODDS: MAX_SELECTION_ODDS.toNumber(),
      AVOID_MAX_EDGE: AVOID_CONFIG.maxEdge,
      H2H_GAMMA,
      H2H_DECAY: H2H_DECAY.toNumber(),
      H2H_MIN_SAMPLE,
      LAMBDA_SHRINKAGE_FACTOR,
      CALIBRATION_GATE_MAX_DIVERGENCE:
        CALIBRATION_GATE.MAX_DIVERGENCE.toNumber(),
      CALIBRATION_GATE_FAVORITE_FLIP_MIN_GAP:
        CALIBRATION_GATE.FAVORITE_FLIP_MIN_GAP.toNumber(),
      CALIBRATION_GATE_SCOPE: 'ONE_X_TWO',
      OVER_UNDER_CALIBRATION_GATE_FAVORITE_FLIP_MIN_GAP:
        OVER_UNDER_CALIBRATION_GATE.FAVORITE_FLIP_MIN_GAP.toNumber(),
      OVER_UNDER_CALIBRATION_GATE_SCOPE:
        'OVER_UNDER (par ligne 1.5/2.5/3.5/4.5)',
    },
    caveats: CAVEATS,
  };
}
