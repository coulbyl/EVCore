/**
 * Hyperparamètres du coupon.
 *
 * Source (réécrite 2026-08-09 — le fichier `backtest-selected-params.json`
 * cité ici auparavant n'existe pas dans ce repo, gap documenté dans
 * docs/formation-content-maintenance.md §5) :
 * packages/db/scripts/backtest-coupon-params-validation.ts, rejouable via
 * `pnpm --filter @evcore/db db:backtest:coupon-params-validation`. Valide sur
 * les 403 vrais `CouponProposal` réglés depuis 2023-04-15 (pas une
 * simulation), split train/valid 60/40 par jour :
 *   - global (tous les paramètres actuels)   : train ROI +28.3% | valid ROI +19.8%
 *   - `minCouponEV` resserré à 0.15           : train ROI +29.2% | valid ROI +23.2%
 *     (0.20+ dégrade train, 0.30 inverse le signe — non retenu)
 *   - `maxCombinedOdds` resserré (≤4/≤5)      : train s'améliore (+36%/+39%)
 *     mais valid s'effondre (-18.5%/-1.6%) — signature de surapprentissage,
 *     PAS resserré, gardé à 6.0.
 *
 * `k`/`capMin`/`capMax`/`decayHalfLifeDays`/`windowDays`/`nLeagueMin` ne sont
 * PAS couverts par ce script (ils alimentent la calibration canal/jour/ligue
 * dans SignalWindowService.computeSignalWindow, pas testée ici) — hérités
 * sans nouvelle validation, à couvrir par un futur backtest dédié.
 *
 * NE PAS modifier manuellement — relancer le backtest ci-dessus pour toute
 * révision.
 */

import { StrategyChannel } from '@evcore/db';

// Any channel can label a coupon leg: the pool admits every non-meta,
// non-filter channel (POOL_ELIGIBLE_CHANNELS) and historical legs additionally
// carry VALUE/SAFE/BTTS/TEAM_TOTAL labels from before the 2026-08-22 switch.
export type CouponChannel = StrategyChannel;

// BTTS staking (B7-style promotion) — the aggregate ROI hides a real
// per-league split. Re-validated 2026-08-09 with a temporal train/valid split
// (db:backtest:channel-league-whitelist, 60/40 by day, confirmed only if both
// halves clear n>=20 AND stay positive): SA dropped out (train -2.84%, valid
// +20.47% — sign flips across the split, not reliably positive) versus the
// 2026-07-28 aggregate-only backtest that had included it. PL/BL1 remain
// confirmed in both periods.
export const BTTS_STAKED_LEAGUES = ['PL', 'BL1'] as const;

// DRAW staking, per-league (added 2026-08-09) — DRAW previously staked
// globally off a single low CANAL_BASE_WEIGHT.DRAW=0.2 prior, which hid a
// per-league ROI spread from +41% to -45%. db:backtest:channel-league-
// whitelist (60/40 split by day, confirmed only if both halves clear n>=20
// AND stay positive) confirms exactly these 4: I2 +6.7%, POR +10.5%,
// BL1 +15.8%, CSL +26.5%/+0.1% (added 2026-08-15, train n=82/valid n=21 — a
// train-period sample finally accumulated). Several other leagues still look
// promising in the aggregate (FRI, KOR1/2, BRA2, WC, CHN2) but have no
// train-period sample yet (too little settled history) — revisit once they
// do, don't add them off the aggregate alone.
export const DRAW_STAKED_LEAGUES = ['I2', 'POR', 'BL1', 'CSL'] as const;

// Channels allowed to contribute a leg to the real coupon pool
// (SignalWindowService.getPoolForRange).
//
// Every channel that produces its OWN pick is admitted. What is excluded is
// only what does not produce an original pick:
//
//   - META (CONSENSUS, CONTRARIAN, AVOID). CONSENSUS re-published a pick that
//     already came from a Phase-1 channel — verified 2026-08-22, all 765 of
//     its settled selections matched another channel's on the same model run,
//     same market, same pick, same probability to 4 decimals — and it no
//     longer emits selections at all (consensus.strategy.ts). AVOID is a
//     rejection signal. CONTRARIAN is unimplemented.
//   - FILTERS (VALUE, SAFE). Phase-2 channels that re-select among Phase-1
//     picks: 89.5% and 93.3% of their selections respectively duplicate a
//     Phase-1 pick exactly. Admitting them would put the same underlying bet
//     in the pool twice under two labels, and the label carries the worse
//     calibration of the two (see below).
//
// Why NOT a quality bar. An earlier version of this list gated admission on
// each channel's measured calibration ratio (>= 0.90), which excluded 11 of
// 19 channels. That was the wrong instrument. Selecting channels by their
// past ratio is itself a selection on a noisy statistic, and it froze the
// pool against a snapshot that concept drift makes stale within weeks. The
// bias each channel carries is now CORRECTED at scoring time instead —
// calibrateLegProbability applies that channel's own Platt curve
// (channel-reliability.ts), so a channel announcing 0.70 that realises 0.51
// enters the pool at ~0.51 and loses on merit, rather than being kept out by
// a list somebody has to maintain. Correcting beats excluding: the channel
// keeps contributing wherever it IS right.
//
// The measurement that motivated all of this (2026-08-22): the pool used to
// read `bet`, which `persistChannelBet` only ever writes for VALUE and SAFE,
// so 4 channels out of 25 could ever produce a leg and the two supplying 68%
// of them were the two worst-calibrated in the system. Structural blindness,
// not a weighting choice.
export const POOL_EXCLUDED_CHANNELS: ReadonlySet<StrategyChannel> = new Set([
  // Meta — read other channels' decisions, emit no original pick.
  StrategyChannel.CONSENSUS,
  StrategyChannel.CONTRARIAN,
  StrategyChannel.AVOID,
  // Filters — re-select among Phase-1 picks (docs/prediction-engine-families.md §0).
  StrategyChannel.VALUE,
  StrategyChannel.SAFE,
]);

export const POOL_ELIGIBLE_CHANNELS: readonly StrategyChannel[] = (
  Object.values(StrategyChannel) as StrategyChannel[]
).filter((channel) => !POOL_EXCLUDED_CHANNELS.has(channel));

export type VirtualCouponChannel =
  | 'SAFE_HT_OVER05'
  | 'SAFE_UNDER45'
  | 'SAFE_OVER15'
  | 'SAFE_UNDER35'
  | 'BTTS_YES';

export type CouponOutputChannel = CouponChannel | VirtualCouponChannel;

// Plafond du nombre de sélections RETENUES par canal dans le POOL (par jour),
// PAS le nombre de jambes d'un coupon — concept distinct des bornes de profil
// (`CouponProfileBounds.maxLegs`). Levée d'ambiguïté B8 : un coupon est borné par
// son profil ; ceci borne combien de candidats d'un canal entrent dans le pool.
// Per-canal cap on legs contributed to one day's coupons. Partial on purpose:
// a channel with no entry uses DEFAULT_MAX_COUPON_SELECTIONS. Caps are earned
// on a channel's own coupon record, so a newly-admitted channel starts at the
// conservative default rather than inheriting a cap another channel earned.
export const DEFAULT_MAX_COUPON_SELECTIONS = 2;

export const MAX_COUPON_SELECTIONS: Partial<Record<CouponChannel, number>> = {
  SAFE: 5,
  BTTS: 5,
  DOMINANT: 5,
  DRAW: 2,
  VALUE: 2,
  // Aligned with the backtested topN=3 ranking (db:backtest:invest-ranking,
  // 2026-07-28) — edge-ranked, not probability-ranked (see MODE_RANKING.teamTotal).
  TEAM_TOTAL: 3,
  // Admitted to the pool 2026-08-22 (POOL_ELIGIBLE_CHANNELS). None has any
  // coupon history yet, so all start at DRAW/VALUE's conservative cap of 2
  // rather than inheriting a cap earned by a different channel's record.
  DRAW_NO_BET: 2,
  WIN_EITHER_HALF: 2,
  HALF_TIME_FULL_TIME: 2,
  DOUBLE_CHANCE: 2,
  WIN_TO_NIL: 2,
  FIRST_HALF: 2,
} as const;

// Fallback prior hit rate, used only when the rolling window has no rate for
// the channel yet. Partial: a channel with no entry uses
// DEFAULT_CANAL_BASE_WEIGHT. Since 2026-08-22 the leg probability itself is
// corrected by the channel's own Platt curve (channel-reliability.ts), so this
// prior no longer carries the calibration burden it used to.
export const DEFAULT_CANAL_BASE_WEIGHT = 0.5;

export const CANAL_BASE_WEIGHT: Partial<Record<CouponChannel, number>> = {
  SAFE: 0.74,
  DOMINANT: 0.66,
  BTTS: 0.62,
  VALUE: 0.36,
  DRAW: 0.2,
  // Conservative launch weight (2026-07-28) — below DRAW's, since TEAM_TOTAL's
  // +3.40% ROI (n=845) rests on only 9 days of history. Revisit once more days
  // accumulate.
  TEAM_TOTAL: 0.15,
  // Admitted 2026-08-22 — prior set to each channel's MEASURED hit rate on
  // settled rank-1 selections with real odds (same query as the calibration
  // ratios documented on POOL_ELIGIBLE_CHANNELS), not to a hand-picked
  // "conservative launch weight". This is a fallback prior used when the
  // rolling window has no rate for the channel yet, so the measured base rate
  // is the honest value.
  DOUBLE_CHANCE: 0.763,
  DRAW_NO_BET: 0.651,
  WIN_EITHER_HALF: 0.608,
  FIRST_HALF: 0.428,
  HALF_TIME_FULL_TIME: 0.28,
  WIN_TO_NIL: 0.257,
} as const;

export const COUPON_PARAMS = {
  k: 20,
  capMin: 0.05,
  capMax: 0.8,
  minCalibratedJointProbability: 0.25,
  // Seuil d'EV de coupon (Étape 1 — EV au cœur du coupon). Un coupon n'est viable
  // que si `couponEV = P_coupon × Odd_coupon − 1 ≥ minCouponEV`. Resserré de
  // 0.05 à 0.15 le 2026-08-09 (db:backtest:coupon-params-validation, sur les
  // 403 CouponProposal réels réglés) : train ROI +28.3%→+29.2%, valid ROI
  // +19.8%→+23.2%, les deux améliorés — 0.20 dégrade train, 0.30 inverse le
  // signe, non retenus.
  minCouponEV: 0.15,
  maxLegs: 3,
  // Plafond de garde-fou, PAS un objectif de compte fixe (revu 2026-08-15,
  // TODO.md "jambe partagée entre rank 1/2/3") — depuis l'incident du 08-15
  // (une même jambe TEAM_TOTAL_HOME présente en rank 1 ET rank 2, tous deux
  // perdus ensemble), `selectDiverseCoupons` n'accepte plus AUCUNE jambe
  // partagée entre coupons publiés (avant : un ratio ≤50% laissait passer une
  // jambe partagée dès qu'un coupon avait ≥3 jambes). Le nombre de coupons
  // publiés dépend donc désormais du pool réel (autant de combinaisons
  // disjointes que le pool le permet) — ce plafond borne juste le haut, pas
  // un nombre à atteindre coûte que coûte.
  maxCoupons: 10,
  maxCombinedOdds: 6.0,
  recencyWeighting: 'exponential_decay_14d' as const,
  decayHalfLifeDays: 14,
  nLeagueMin: 15,
  windowDays: 38,
  includeConfInCoupons: true,
  couponMinSample: {
    SAFE: 10,
    BTTS: 10,
    VALUE: 5,
    DOMINANT: 20,
    DRAW: 20,
    TEAM_TOTAL: 20,
    DRAW_NO_BET: 20,
    WIN_EITHER_HALF: 20,
    HALF_TIME_FULL_TIME: 20,
    DOUBLE_CHANCE: 20,
    WIN_TO_NIL: 20,
    FIRST_HALF: 20,
  } as Partial<Record<CouponChannel, number>>,
} as const;

/**
 * Correction de la surconfiance de `jointProbability` (audit 2026-08-12, 409
 * `CouponProposal` réglés) — le produit brut des probas par jambe ne corrige
 * pas la corrélation entre jambes (même jour, même round, même scénario
 * incertain) : le bucket ~44% annoncé s'est réglé à ~20% réel sur un seul
 * bucket, n=30, cause du coupon manuel perdu du 2026-08-11.
 *
 * Mécanique choisie délibérément : facteur multiplicatif plutôt que le
 * shrinkage bayésien de `calibrate()` — `calibrate()` shrink un TAUX déjà
 * mesuré sur un vrai échantillon pondéré (dizaines d'observations), un
 * `jointProbability` de coupon n'a pas cet équivalent ; le traiter comme "1
 * observation" face au même `k` l'écraserait vers `prior` quel que soit le
 * raw, recréant le bug dégénéré que `LEG_PROBABILITY_MODEL_WEIGHT` avait déjà
 * corrigé. Le facteur multiplicatif préserve l'ordre et la granularité
 * pick-spécifique.
 *
 * `factor` = 1.0 (neutre, PAS de correction actuellement appliquée) — revu
 * 2026-08-15 après `db:backtest:joint-probability-calibration` sur les 410
 * `CouponProposal` réglés (train/valid 60/40 par jour, comme
 * `coupon-params-validation.ts`) :
 *   - factor=1.0 (système historique, sans correction) : train ROI +30.0%,
 *     valid ROI +22.9%, les deux positifs, n≥20 des deux côtés.
 *   - factor=0.8 : train ROI -18.2%, valid ROI +74.3% — signe qui s'inverse,
 *     non actionnable.
 *   - factor=0.7 : même inversion de signe, et n<20 des deux côtés.
 *   - factor=0.4545 (valeur initialement retenue après l'audit) : n=0 des
 *     deux côtés — élimine tout l'historique des seuils actuels, confirmé
 *     indépendamment par un replay du 08-13→08-16 avec le moteur actuel.
 * Conclusion : le biais du bucket ~44%→20% (n=30) ne se généralise PAS en un
 * facteur global — l'appliquer partout sur-corrige et élimine un historique
 * par ailleurs rentable. Facteur remis à 1.0 (no-op) en attendant une
 * calibration PAR BUCKET de probabilité (le bucket 44% peut rester
 * spécifiquement biaisé sans que ça généralise). Le mécanisme
 * (`calibrateJointProbability`, appliqué partout — filtre, EV, Kelly,
 * persistance) reste en place pour recevoir cette calibration par bucket une
 * fois construite ; seule la valeur du facteur est neutralisée ici.
 */
export const JOINT_PROBABILITY_CORRELATION_FACTOR = {
  factor: 1.0,
  capMin: 0.01,
  capMax: 0.8,
} as const;

/**
 * Selection-bias deflation of `couponEV` (Bailey & López de Prado's Deflated
 * Sharpe Ratio, applied to a combinatorial search instead of a backtest grid).
 *
 * `compose()` enumerates every admissible leg combination for the day and
 * keeps the best by EV. Taking the maximum over N trials inflates the winning
 * metric mechanically, with NO underlying edge required: the expected maximum
 * of N draws grows like sqrt(2 ln N) standard deviations above the mean. The
 * old fixed `JOINT_PROBABILITY_CORRELATION_FACTOR` could not model this,
 * because the inflation depends on how wide the search actually was that day —
 * a 6-leg pool and a 60-leg pool are not the same statistical situation.
 *
 * Deflation applied to the winning coupon's EV:
 *
 *     deflated = couponEV - sigma * sqrt(2 * ln(max(trials, e)))
 *
 * `sigma` is the day-to-day dispersion of coupon outcomes, not a fitted
 * parameter: a coupon returns `odds - 1` or `-1`, so its standard deviation is
 * dominated by the odds level. It is measured per composition from the
 * candidate set rather than hardcoded.
 *
 * Deflation is applied to the VIABILITY FILTER and the RANKING only — the
 * persisted `couponEV` stays the raw, interpretable "P x odds - 1" a human can
 * recompute by hand from the stored legs.
 *
 * `trialsCap` bounds the log term so a pathologically wide pool (LONGSHOT
 * profiles read 3 days of fixtures) cannot deflate every candidate below the
 * threshold and publish nothing.
 */
export const COUPON_EV_DEFLATION = {
  enabled: true,
  trialsCap: 100_000,
} as const;

/**
 * Plancher de probabilité calibrée par jambe — désormais porté par le PROFIL
 * (`CouponProfileBounds.minLegProbability`), plus par une constante globale.
 *
 * Il existait comme constante unique à 0.55 (2026-08-15), après un coupon perdu
 * où une jambe à 43.4% était passée sur un EV gonflé (cote 3.75, edge apparent
 * 0.167). L'intention était juste, mais elle confondait deux choses :
 *
 *   - une jambe annoncée à 43% qui vaut en réalité bien moins — c'est un
 *     défaut de CALIBRATION, corrigé depuis par la courbe par canal
 *     (channel-reliability.ts) ;
 *   - une jambe correctement estimée à 31% à la cote 3.90 — c'est un pari de
 *     valeur parfaitement sain, que le plancher rejetait pour la seule raison
 *     qu'il est plus probable de perdre que de gagner UNE jambe.
 *
 * Le second cas coûtait cher. Mesuré le 2026-08-22 sur les sélections réglées
 * à cote réelle, part des picks au-dessus de 0.55 :
 *
 *     DRAW 0.0% · CORRECT_SCORE 0.0% · RESULT_TOTAL_GOALS 0.4% ·
 *     HALF_TIME_FULL_TIME 0.6% · WIN_TO_NIL 1.1% · RESULT_BTTS 1.4% ·
 *     FIRST_HALF 2.9% · CLEAN_SHEET 3.8%
 *
 * Huit canaux sur dix-neuf ne pouvaient produire AUCUNE jambe, dont DRAW — le
 * mieux calibré du système (ratio réalisé/annoncé 1.016, ROI +1.7%, n=7421).
 * Tout l'appareillage DRAW_STAKED_LEAGUES (whitelist backtestée, 4 ligues)
 * était mort : aucun pick DRAW n'atteignait jamais 0.55.
 *
 * Ce que le plancher visait vraiment — « le coupon doit pouvoir tomber » — est
 * déjà exprimé directement, et correctement, par `minJointProbability` : c'est
 * la probabilité du COUPON qui compte, pas celle d'une jambe isolée. Trois
 * jambes à 0.31 donnent un coupon à 3%, ce qui est un profil LONGSHOT assumé,
 * pas un défaut.
 *
 * Porté au profil parce que l'appétit de risque est précisément ce qu'un
 * profil exprime : SAFE veut légitimement des jambes hautes, LONGSHOT ne le
 * peut pas. `undefined` = pas de plancher par jambe (le profil s'en remet à
 * `minJointProbability`).
 *
 * ⚠️ Valeurs ci-dessous à confirmer par un cycle régénère+règle avant de les
 * considérer acquises — elles élargissent le pool de façon substantielle.
 */
export const LEGACY_MIN_LEG_PROBABILITY = 0.55;

// Un plancher MIN_LEG_SIGNAL_SCORE (0.6) a été essayé le 2026-08-20 pour
// forcer une vraie séparation au rang 1 (qui ne battait pas le rang 2/3 même
// après le tri par signalScore, cf. compareCouponsBySignalThenEV) — retiré le
// jour même : une fois testé avec l'outil de backtest corrigé, il écrase
// VALUE au point que SAFE domine le pool par défaut, et SAFE porte sa propre
// surconfiance jamais corrigée (ex. OVER_UNDER_HT annoncé 73.5%, réel 20%).
// Pas réintroduit sans un vrai fix de la calibration SAFE en amont.

/**
 * Plancher de probabilité calibrée pour qu'une jambe soit une "ancre" (porte
 * la probabilité jointe du coupon) plutôt qu'une jambe "valeur" (porte la
 * cote combinée) — trouvé 2026-08-15, même incident/discussion que
 * `MIN_LEG_PROBABILITY`. Le composeur automatique ne triait le pool candidat
 * QUE par `signalScore` (moyenne canal×jour×ligue, identique pour toutes les
 * jambes d'un même canal/ligue/jour) puis par EV sous contraintes — jamais
 * de mix délibéré ancre/valeur. `COUPON_ANALYSIS_TEMPLATE.md` (Étape 0)
 * documente que la méthode manuelle qui marche mélange TOUJOURS quelques
 * jambes-ancres (70-90%+) et quelques jambes-valeur (60-75%, meilleure cote)
 * — jamais un seul mode. `ANCHOR_MIN_PROBABILITY=0.70` reprend le bas de
 * cette fourchette documentée ; pas backtesté pour le composeur automatique.
 */
export const ANCHOR_MIN_PROBABILITY = 0.7;

/**
 * Plafond de jambes par compétition dans le POOL CANDIDAT (avant recherche
 * combinatoire).
 *
 * Relevé de 2 à 6 le 2026-08-22. À 2, il bridait le pool **81 jours sur 108**
 * mesurés (2026-05-01→08-17) : avec 10.1 compétitions en moyenne par jour, le
 * pool ne pouvait atteindre que ~14.8 des 25 places de `MAX_POOL_SIZE`, soit
 * 41% de la capacité inatteignable par construction — et 1 seule compétition
 * sur le jour le plus creux, donc 2 jambes candidates en tout.
 *
 * Ce n'était pas un garde-fou nécessaire : la concentration par ligue DANS un
 * coupon publié est déjà bornée à 2 par `violatesAntiCorrelation`
 * (coupon-composer.service.ts), qui s'applique au produit final. Le plafond de
 * pool ne protégeait donc rien de plus — il réduisait seulement le choix
 * offert à la recherche combinatoire, ce qui est exactement la ressource dont
 * le composeur manque.
 *
 * Gardé à une valeur non nulle malgré tout : le pool alimente aussi le mix
 * ancre/valeur de `buildCandidatePool`, et une ligue unique monopolisant les
 * deux moitiés reste indésirable même si le coupon final ne peut pas en
 * publier plus de 2.
 */
export const MAX_POOL_PER_COMPETITION = 6;

/**
 * Marché évalué (`ModelRun.features.evaluatedPicks`, `status: 'viable'`) →
 * canal coupon — trouvé 2026-08-16 en creusant le biais suspecté dans
 * `SignalWindowService` : `getPoolForRange` (le vrai pool de coupon) ne lit
 * que les `Bet`/`channelDecision` déjà matérialisés, une seule jambe par
 * canal par match — jamais les autres marchés évalués sur le même match,
 * alors que `evaluatedPicks` existe déjà et est même déjà utilisé (par la
 * fonction sœur `getTodayVirtualPool`, jamais pour le pool réel). Exactement
 * le trou documenté par `COUPON_ANALYSIS_TEMPLATE.md` (Étape 0) : "parcourir
 * evaluatedPicks en entier, pas juste selectedPicks".
 *
 * Mapping délibérément simple — PAS une reproduction de la logique de
 * sélection de chacun des 6 canaux (VALUE/SAFE/DOMINANT/BTTS/DRAW/TEAM_TOTAL,
 * tous différents, certains inter-dépendants comme SAFE qui exclut le pick
 * de VALUE) contre le snapshot persistée (`EvaluatedPickSnapshot`, lossy —
 * `number` simple, pas de `Decimal`, pas de contexte ligue par jambe) :
 * `status: 'viable'` a déjà passé les gates du système (probabilité
 * plancher, cote dans la fourchette, marché non suspendu, EV dans une bande
 * acceptable, pas de pénalité longshot) — ce n'est pas un rejet de fiabilité
 * de ne pas avoir gagné l'arbitrage de son canal contre les autres marchés
 * du même match. `MIN_LEG_PROBABILITY`/`clearsValueEdgeFloor` (déjà en place)
 * suffisent en aval comme garde-fous coupon.
 *
 * - ONE_X_TWO → DOMINANT (son propre marché ; DOMINANT n'était jusqu'ici
 *   JAMAIS lu dans le pool réel — ni `Bet` ni `channelDecision` promu —
 *   confirmé : 0 jambe DOMINANT dans `coupon_proposal_leg` historiquement).
 * - TEAM_TOTAL_HOME/AWAY → TEAM_TOTAL, BTTS → BTTS (marchés dédiés).
 * - CORRECT_SCORE → exclu (absent de ce mapping) — signal immature confirmé
 *   par plusieurs pistes invalidées (AUC=0.51, quasi hasard ; voir TODO.md/
 *   mémoire `project_correct_score_immature`), jamais staké nulle part.
 * - Tout le reste (OVER_UNDER, OVER_UNDER_HT, DOUBLE_CHANCE,
 *   HALF_TIME_FULL_TIME, FIRST_HALF_WINNER, DRAW_NO_BET, CLEAN_SHEET_*,
 *   WIN_TO_NIL_*, TO_WIN_EITHER_HALF, RESULT_TOTAL_GOALS, RESULT_BTTS) →
 *   VALUE, le canal `ALL_MARKETS` déjà le plus large (value.strategy.ts).
 */
// Rewritten 2026-08-22. Every market now maps to the channel that actually
// specialises in it, instead of being dumped on VALUE.
//
// The old mapping sent 13 of 17 markets to 'VALUE' — not because VALUE had
// any claim on them, but because VALUE was one of only four canals that could
// carry a coupon leg at all (the pool read `bet`, which only VALUE and SAFE
// ever populate). That fallback became a hole the moment pool admission moved
// to POOL_ELIGIBLE_CHANNELS: an evaluated DRAW_NO_BET pick relabelled 'VALUE'
// re-entered the pool wearing the label of the channel with the worst
// calibration ratio in the system (0.729), and picked up VALUE's calibrated
// hit rate in scorePicks on the way in — bypassing the admission list from
// behind and mis-scoring itself twice over.
//
// Markets whose owning channel is NOT in POOL_ELIGIBLE_CHANNELS are simply
// absent from this map: `resolveEvaluatedMarketLeg` drops any market it
// cannot resolve, so exclusion here is the same decision as exclusion from
// the pool, applied consistently to both entry paths.
export const EVALUATED_MARKET_CANAL: Record<string, CouponChannel> = {
  ONE_X_TWO: StrategyChannel.DOMINANT,
  OVER_UNDER: StrategyChannel.GOALS,
  OVER_UNDER_HT: StrategyChannel.OVER_UNDER_HT,
  BTTS: StrategyChannel.BTTS,
  TEAM_TOTAL_HOME: StrategyChannel.TEAM_TOTAL,
  TEAM_TOTAL_AWAY: StrategyChannel.TEAM_TOTAL,
  DOUBLE_CHANCE: StrategyChannel.DOUBLE_CHANCE,
  DRAW_NO_BET: StrategyChannel.DRAW_NO_BET,
  HALF_TIME_FULL_TIME: StrategyChannel.HALF_TIME_FULL_TIME,
  FIRST_HALF_WINNER: StrategyChannel.FIRST_HALF,
  TO_WIN_EITHER_HALF: StrategyChannel.WIN_EITHER_HALF,
  CLEAN_SHEET_HOME: StrategyChannel.CLEAN_SHEET,
  CLEAN_SHEET_AWAY: StrategyChannel.CLEAN_SHEET,
  WIN_TO_NIL_HOME: StrategyChannel.WIN_TO_NIL,
  WIN_TO_NIL_AWAY: StrategyChannel.WIN_TO_NIL,
  RESULT_TOTAL_GOALS: StrategyChannel.RESULT_TOTAL_GOALS,
  RESULT_BTTS: StrategyChannel.RESULT_BTTS,
  // CORRECT_SCORE stays out: its scoreline signal is validated for
  // reasonDetails only, never for staking (TODO.md, 2026-08-15).
} as const;

// ─────────────────────────────────────────────
// Profils de risque (Étape 4 — corrige B8/B9)
// ─────────────────────────────────────────────

export type CouponProfileName =
  | 'SAFE'
  | 'BALANCED'
  | 'AGGRESSIVE'
  | 'LONGSHOT_WEEKEND'
  | 'LONGSHOT_MIDWEEK';

/**
 * Bornes d'un profil de risque — source unique des contraintes appliquées par
 * `CouponComposerService.compose`. Un coupon n'est viable que s'il respecte TOUTES
 * ces bornes : nombre de jambes, cote combinée, proba jointe et EV de coupon.
 */
export type CouponProfileBounds = {
  /**
   * Plancher de probabilité calibrée par jambe. `undefined` = aucun plancher,
   * le profil s'en remet à `minJointProbability` (voir
   * LEGACY_MIN_LEG_PROBABILITY pour pourquoi ce plancher a quitté le global).
   */
  minLegProbability?: number;
  minLegs: number;
  maxLegs: number;
  minCombinedOdds: number;
  maxCombinedOdds: number;
  minJointProbability: number;
  minCouponEV: number;
  /**
   * Plafond de jambes par jour calendaire (`ScoredPick.dayBucket`) — évite
   * qu'un coupon multi-jours (fenêtre weekend/midweek) concentre tout son
   * risque sur un seul jour. `undefined` = pas de plafond (profils mono-jour
   * actuels, comportement inchangé).
   */
  maxLegsPerDay?: number;
  /**
   * Override du pool de candidats (défaut : `MAX_POOL_SIZE` dans
   * coupon-composer.service.ts, 25) avant `composeExhaustive`/`composeGreedy`.
   * Nécessaire pour LONGSHOT (voir TODO.md "Générateur de coupon") : la règle
   * anti-corrélation "1 leg/canal+marché" limite le nombre de jambes utilisables
   * à peu près au nombre de combos canal×marché distincts du pool — avec
   * `minLegs: 6`, un pool à 25 concentré sur peu de canaux (SAFE domine via
   * `CANAL_BASE_WEIGHT`) starve `composeGreedy` avant d'atteindre `minLegs`,
   * d'où 0 coupon LONGSHOT généré (confirmé par l'audit 2026-08-12 — pas un
   * bug de câblage, un pool structurellement trop court pour ce profil).
   * `undefined` = pas d'override (profils SAFE/BALANCED/AGGRESSIVE, comportement
   * inchangé).
   */
  maxPoolSize?: number;
};

/**
 * Au-delà de ce nombre de jambes, `compose()` bascule de la recherche
 * exhaustive (`composeExhaustive`, DFS sur le pool trié) au glouton borné
 * (`composeGreedy`) — C(25,5)=2300 combinaisons reste traitable, C(25,8)≈1M
 * ne l'est plus. Les profils actuels (SAFE/BALANCED/AGGRESSIVE, ≤5 legs)
 * restent tous sur l'exhaustif ; seuls les profils LONGSHOT (8-12 legs)
 * basculent sur le glouton.
 */
export const EXHAUSTIVE_LEG_THRESHOLD = 5;

/**
 * Nombre de points de départ distincts essayés par `composeGreedy` (chacun
 * force la jambe de rang N du pool trié en premier, puis complète glouton) —
 * donne plusieurs coupons longshot candidats au lieu d'un seul, sans repasser
 * à une recherche exhaustive intraitable sur autant de jambes.
 */
export const GREEDY_START_VARIANTS = 3;

/**
 * Profils indicatifs (DESIGN.md Étape 4) — **valeurs à confirmer par backtest,
 * pas encore activées en génération** (cf. gate Étape 7). La génération live passe
 * par `DEFAULT_COUPON_PROFILE` (bornes backtestées). Ces presets sont disponibles
 * pour expérimentation / backtest avant promotion.
 */
export const COUPON_PROFILES: Record<CouponProfileName, CouponProfileBounds> = {
  SAFE: {
    minLegProbability: 0.6,
    minLegs: 2,
    maxLegs: 3,
    minCombinedOdds: 1.6,
    maxCombinedOdds: 2.5,
    minJointProbability: 0.45,
    minCouponEV: 0.03,
  },
  BALANCED: {
    minLegProbability: 0.5,
    minLegs: 2,
    maxLegs: 4,
    minCombinedOdds: 2.2,
    maxCombinedOdds: 5.0,
    minJointProbability: 0.25,
    minCouponEV: 0.08,
  },
  AGGRESSIVE: {
    minLegProbability: 0.4,
    minLegs: 3,
    maxLegs: 5,
    minCombinedOdds: 4.0,
    maxCombinedOdds: 12.0,
    minJointProbability: 0.1,
    minCouponEV: 0.15,
  },
  // Longshot multi-jours (plan coupon 2026-08-09) — cote combinée cible
  // 50-70 sur la fenêtre weekend (ven→dim) / midweek européen (mar→jeu),
  // routé vers CouponComposerService.composeGreedy (> EXHAUSTIVE_LEG_THRESHOLD
  // legs). maxLegsPerDay évite qu'un coupon 3 jours se concentre sur un seul
  // jour. Valeurs indicatives — comme SAFE/BALANCED/AGGRESSIVE, à confirmer
  // par un backtest dédié (db:backtest:coupon-longshot, pas encore écrit)
  // avant toute activation en génération live.
  LONGSHOT_WEEKEND: {
    // Aucun plancher par jambe : un longshot à cote 50-70 se construit
    // précisément sur des jambes que 0.55 interdisait.
    minLegs: 6,
    maxLegs: 12,
    minCombinedOdds: 50.0,
    maxCombinedOdds: 70.0,
    minJointProbability: 0.01,
    minCouponEV: 0.2,
    maxLegsPerDay: 5,
    // Pool dédié plus large (défaut 25) — voir maxPoolSize doc ci-dessus. Une
    // fenêtre weekend couvre 3 jours de matchs (ven→dim) contre un seul pour
    // les profils courts, donc un pool nettement plus large reste cohérent
    // avec le volume de jambes réellement disponible sur la fenêtre.
    maxPoolSize: 80,
  },
  LONGSHOT_MIDWEEK: {
    minLegs: 6,
    maxLegs: 12,
    minCombinedOdds: 50.0,
    maxCombinedOdds: 70.0,
    minJointProbability: 0.01,
    minCouponEV: 0.2,
    maxLegsPerDay: 5,
    maxPoolSize: 80,
  },
} as const;

/**
 * Profil appliqué en génération live — dérivé des paramètres **backtestés**
 * (`COUPON_PARAMS`, backtest 2026-05-19), donc aucune régression vs l'existant.
 * Correspond grosso modo à un BALANCED élargi ; les profils nommés ci-dessus ne le
 * remplacent qu'après gate de backtest vert (Étape 7).
 */
export const DEFAULT_COUPON_PROFILE: CouponProfileBounds = {
  // Abaissé de 0.55 (ancien global) à 0.45 : au-dessus de 0.55 les canaux les
  // mieux calibrés du système ne peuvent produire aucune jambe (voir
  // LEGACY_MIN_LEG_PROBABILITY). 0.45 laisse entrer DRAW_NO_BET, GOALS,
  // WIN_EITHER_HALF et FIRST_HALF sans ouvrir jusqu'aux marchés à 0.15-0.30,
  // que `minJointProbability` gouverne mieux au niveau du coupon.
  minLegProbability: 0.45,
  minLegs: 2,
  maxLegs: COUPON_PARAMS.maxLegs,
  minCombinedOdds: 1.0,
  maxCombinedOdds: COUPON_PARAMS.maxCombinedOdds,
  minJointProbability: COUPON_PARAMS.minCalibratedJointProbability,
  minCouponEV: COUPON_PARAMS.minCouponEV,
};

export function resolveCouponProfile(
  name?: CouponProfileName,
): CouponProfileBounds {
  return name ? COUPON_PROFILES[name] : DEFAULT_COUPON_PROFILE;
}

export type VirtualCouponRule = {
  canal: VirtualCouponChannel;
  label: string;
  market: string;
  pick: string;
  prior: number;
  minProbability: number;
  maxProbability: number;
  minOdds?: number;
  maxOdds?: number;
  minEvMargin?: number;
  minLambda?: number;
  allowMissingOdds?: boolean;
  excludedLeagues?: readonly string[];
  excludedProbabilityRanges?: readonly (readonly [number, number])[];
  leagueBoosts?: Partial<Record<string, number>>;
  channelCapTop5?: number;
  channelCapTop10?: number;
};

export const VIRTUAL_COUPON_RULES: readonly VirtualCouponRule[] = [
  {
    canal: 'SAFE_HT_OVER05',
    label: 'Over 0.5 HT',
    market: 'OVER_UNDER_HT',
    pick: 'OVER_0_5',
    prior: 0.805,
    minProbability: 0.75,
    maxProbability: 0.85,
    maxOdds: 1.5,
    excludedLeagues: ['EL1'],
  },
  {
    canal: 'SAFE_UNDER45',
    label: 'Under 4.5',
    market: 'OVER_UNDER',
    pick: 'UNDER_4_5',
    prior: 0.818,
    minProbability: 0.75,
    maxProbability: 0.95,
    maxOdds: 1.5,
    excludedLeagues: ['NOR2', 'TUR1'],
  },
  {
    canal: 'SAFE_OVER15',
    label: 'Over 1.5',
    market: 'OVER_UNDER',
    pick: 'OVER_1_5',
    prior: 0.738,
    minProbability: 0.75,
    maxProbability: 0.85,
    maxOdds: 1.5,
    minEvMargin: 0.03,
    excludedLeagues: ['EL1'],
  },
  {
    canal: 'SAFE_UNDER35',
    label: 'Under 3.5',
    market: 'OVER_UNDER',
    pick: 'UNDER_3_5',
    prior: 0.692,
    minProbability: 0.65,
    maxProbability: 0.85,
    maxOdds: 1.8,
    excludedLeagues: ['MX1'],
    excludedProbabilityRanges: [[0.75, 0.8]],
    leagueBoosts: { CH: 0.08 },
  },
  {
    canal: 'BTTS_YES',
    label: 'BTTS Yes',
    market: 'BTTS',
    pick: 'YES',
    prior: 0.655,
    minProbability: 0.6,
    maxProbability: 0.75,
    allowMissingOdds: true,
    minLambda: 3.1,
    excludedLeagues: ['ERD', 'EL1', 'EL2'],
    excludedProbabilityRanges: [[0.65, 0.7]],
    leagueBoosts: { SP2: 0.06 },
    channelCapTop5: 1,
  },
] as const;

export const MAX_VIRTUAL_COUPON_SELECTIONS: Record<
  VirtualCouponChannel,
  number
> = {
  SAFE_HT_OVER05: 5,
  SAFE_UNDER45: 5,
  SAFE_OVER15: 5,
  SAFE_UNDER35: 5,
  BTTS_YES: 5,
} as const;

export const VIRTUAL_COUPON_TOP_LIMITS = {
  top5: 5,
  top10: 10,
  channelCapTop5: 2,
  channelCapTop10: 3,
} as const;
