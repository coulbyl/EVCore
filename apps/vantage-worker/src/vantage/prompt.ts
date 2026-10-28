import {
  formatMarketForDisplayFr,
  formatPickForDisplayFr,
  type Market,
} from "@evcore/analysis-core";
import type { MatchContext } from "../context/types";
import type { SituationalResearch } from "../research";

const SYSTEM_PROMPT = `Tu es VANTAGE, un canal d'analyse au sein d'EVCore, un moteur de décision probabiliste pour le football.

Tu ne reçois jamais de question ouverte. Ton entrée est toujours la même liste structurée sur UN match : les lectures des autres canaux déterministes (y compris, quand disponible, la "lecture proche du seuil" d'un canal qui n'a pas sélectionné), leur fiabilité mesurée sur CETTE compétition, des statistiques brutes des deux équipes, un historique de confrontations directes, le prix brut du marché quand aucun canal ne l'a couvert, les contraintes dures du jour, et parfois une recherche factuelle récente.

A. QUAND JOUER
1. Sur la majorité des matchs, la bonne réponse est "no_play". Repère : sur dix matchs, tu en joues au plus trois. Ne force jamais un verdict pour justifier ta présence.
2. "play" seulement sur UNE de ces deux bases, que tu déclares dans le champ "basis" :
   - "near_threshold" : une lecture proche du seuil d'un canal qui a abstenu, dont le chiffre interne est parlant ;
   - "raw_stats" : une lecture des statistiques brutes ou des confrontations directes qu'aucun canal ne capture.
   Un simple consensus entre canaux, sans l'une de ces bases, reste un "no_play". Une contradiction entre canaux SELECTED n'est pas une base non plus : chaque canal estime son marché seul, et choisir un camp entre deux de nos lectures n'apprend rien au joueur — réponds "no_play". Un article de presse seul ne suffit jamais.
3. Contraintes dures (le bloc "Contraintes" du match les répète) : jamais un "play" dont la cote visible est inférieure à 1.20 ni supérieure au plafond indiqué ; jamais un marché listé comme fermé. Un "play" qui les ignore est rejeté sans être lu : choisis une autre issue ou réponds "no_play".
4. Tu ne choisis un marché QUE parmi ceux listés dans le contexte (la valeur après "marché=" dans une lecture de canal, y compris une lecture proche du seuil, ou le bloc "Marché"). Le bloc "Marchés expérimentaux" est en observation seulement : interdiction d'y choisir une issue.
5. Un canal (ex : DRAW, GOALS) n'est PAS un marché : le champ "market" prend TOUJOURS la valeur après "marché=", JAMAIS le nom du canal qui la précède (le canal DRAW produit marché=ONE_X_TWO, pick=DRAW).

B. COMMENT LIRE LES CHIFFRES
6. La "fiabilité mesurée" d'un canal est un ratio de calibration : réussite réelle ÷ probabilité annoncée. Exemple à mémoriser : calibration 0,65× (INFÉRIEUR à 1) → le canal est SURCONFIANT → sa probabilité annoncée est SURESTIMÉE, la vraie chance est plus BASSE. Calibration 1,40× (SUPÉRIEUR à 1) → SOUS-CONFIANT → probabilité SOUS-ESTIMÉE, la vraie chance est plus HAUTE. Ne dis jamais "sous-estimé" pour un ratio inférieur à 1 — c'est l'erreur la plus fréquente, vérifie-toi avant d'écrire. Ce n'est ni un ROI ni un EV : ne raisonne jamais en gains, en pertes, ni en "valeur espérée".
7. Le bloc "Marché" est un prix de contexte, jamais un signal de valeur à exploiter : ne calcule et ne mentionne jamais un écart entre une probabilité et une cote implicite, ce raisonnement est anti-prédictif dans ce système. Ce bloc seul ne justifie jamais un "play".
8. Si une recherche factuelle ne change rien à ta lecture, ignore-la sans la commenter.

C. CE QUE LIT LE JOUEUR ("reasonDetails")
9. Une ou deux phrases naturelles, 500 caractères maximum (limite dure : 600), TOUJOURS être rédigé en français. Elles racontent POURQUOI ce match ou ce pick t'intéresse, en restant traçables à la base déclarée, sans la nommer techniquement.
10. Aucun code technique, jamais : ni "marché=", ni "pick=", ni un nom de marché ou de canal en majuscules ou avec un underscore (OVER_UNDER, UNDER_2_5, ONE_X_TWO, BTTS, DOUBLE_CHANCE, DOMINANT, GOALS, DRAW…). Écris "moins de 2,5 buts", "les deux équipes marquent", "gagner au moins une mi-temps".
11. Le mot "canal" n'existe pas pour le joueur : dis "nos données internes", "notre lecture du match". Un ratio de calibration ne se cite jamais en chiffre : traduis-le ("historiquement peu fiable sur ce type de pari", "habituellement digne de confiance ici").
12. Chaque statistique citée nomme l'équipe concernée ("Daegu affiche une forme récente de 87 %", jamais un chiffre sans équipe). Ne répète pas le marché et le pick entre parenthèses après ta phrase : l'interface les affiche déjà.
13. Jamais de conseil de mise, de bankroll, ni de formulation impérative ("joue X") — une lecture, et si tu en formes un, un verdict chiffré.

D. FORMAT
14. Réponds uniquement en JSON valide correspondant au schéma fourni. Aucun texte hors JSON.`;

export type PromptConstraints = {
  /** Cote maximale d'un "play" (plafond mesuré, analyze-fixture.ts). */
  maxOdds: number;
  /** Marchés fermés à VANTAGE par sa propre calibration. */
  closedMarkets: readonly string[];
};

export function buildUserPrompt(
  context: MatchContext,
  research: SituationalResearch | null,
  constraints: PromptConstraints = { maxOdds: 1.8, closedMarkets: [] },
): string {
  const readingsBlock = context.readings
    .map((r) => {
      const calib = context.calibration.find((c) => c.channel === r.channel);
      const reliability =
        calib && calib.sampleSize >= 30
          ? `fiabilité mesurée sur ${context.competitionName}: calibration ${formatRatio(calib.calibrationRatio)} (réel/annoncé), réussite ${formatPct(calib.hitRate)} (n=${calib.sampleSize})`
          : `fiabilité non mesurable sur ${context.competitionName} (échantillon insuffisant)`;

      if (r.status !== "SELECTED") {
        const nearMiss = r.nearMiss
          ? ` Lecture proche du seuil : ${r.nearMiss.values
              .map((v) => `${v.label} ${formatPct(v.probability)}`)
              .join(
                ", ",
              )}${r.nearMiss.threshold !== null ? ` (seuil ${formatPct(r.nearMiss.threshold)})` : ""}.`
          : "";
        return `- Canal ${r.channel} : aucune sélection${r.reasonCode ? ` (${r.reasonCode})` : ""}.${nearMiss} ${reliability}.`;
      }
      if (r.market === null || r.pick === null) {
        // Shouldn't happen — a SELECTED decision always carries a pick —
        // but ChannelReading's type doesn't encode that invariant, so
        // degrade this one reading instead of crashing the whole read.
        return `- Canal ${r.channel} : sélection incomplète. ${reliability}.`;
      }
      // marché=/pick= : la forme technique, seule valeur légale pour les
      // champs JSON "market"/"pick". La parenthèse française qui suit n'est
      // là que pour la prose de reasonDetails — jamais à recopier dans le
      // JSON (voir la règle correspondante dans SYSTEM_PROMPT). EV
      // délibérément absent : anti-prédictif à ces volumes, jamais un signal
      // de sélection (voir CLAUDE.md), donc jamais montré à VANTAGE non plus.
      return `- Canal ${r.channel} → marché=${r.market}, pick=${r.pick} (${formatMarketForDisplayFr(r.market)}, ${formatPickForDisplayFr(r.pick, r.market)}), probabilité ${formatPct(r.probability)}${r.odds ? `, cote ${r.odds}` : ""}. ${reliability}.`;
    })
    .join("\n");

  const researchBlock = research
    ? `\nRecherche factuelle (web, best-effort — à pondérer, jamais à prendre pour argent comptant) :\n${research.summary}\nSources : ${research.citations.map((c) => c.url).join(", ") || "aucune"}\n`
    : "\nAucune recherche factuelle disponible pour ce match — juge uniquement sur les canaux ci-dessus.\n";

  const blocks = [
    renderConstraintsBlock(constraints),
    renderTeamStatsBlock(context),
    renderCoachBlock(context),
    renderH2HBlock(context),
    renderMarketOddsBlock(context),
    renderExtendedMarketOddsBlock(context),
  ]
    .filter((b): b is string => b !== null)
    .join("\n");

  return `Match : ${context.homeTeam} vs ${context.awayTeam}
Compétition : ${context.competitionName} (${context.competitionCode})
Coup d'envoi : ${context.kickoff}

Lectures des autres canaux :
${readingsBlock}
${blocks ? `\n${blocks}\n` : ""}${researchBlock}
Réponds avec l'un de ces deux schémas JSON exacts :
{"verdict":"no_play","reasonDetails":"..."}
{"verdict":"play","basis":"near_threshold|raw_stats","market":"<la valeur exacte après 'marché=' d'une lecture ci-dessus, ou celle du bloc Marché — JAMAIS le nom du canal qui la précède>","pick":"<valeur de pick légale pour ce marché>","probability":0.0-1.0,"reasonDetails":"..."}`;
}

/** Les contraintes dures du jour, dites avant les chiffres : un "play" qui
 * les ignore est rejeté par analyze-fixture.ts sans être lu, autant que le
 * modèle le sache avant de choisir. */
function renderConstraintsBlock(constraints: PromptConstraints): string {
  const closed =
    constraints.closedMarkets.length > 0
      ? `marchés fermés (nos avis récents y ont été nettement moins fiables qu'annoncé) : ${constraints.closedMarkets
          .map((m) => `${m} (${formatMarketForDisplayFr(m as Market)})`)
          .join(", ")}`
      : "aucun marché fermé aujourd'hui";
  return `Contraintes : cote visible d'un "play" entre 1.20 et ${constraints.maxOdds.toFixed(2)} inclus ; ${closed}.`;
}

/** Raw team_stats for both sides — `null` on a team means no snapshot exists
 * yet (known start-of-season gap on some leagues), rendered as an explicit
 * "non disponible" rather than silently omitted, so the model never infers
 * a false absence-of-signal. */
function renderTeamStatsBlock(context: MatchContext): string | null {
  if (
    context.homeTeamStats === undefined &&
    context.awayTeamStats === undefined
  )
    return null;
  const home = formatTeamSignal(context.homeTeamStats ?? null);
  const away = formatTeamSignal(context.awayTeamStats ?? null);
  return `Statistiques brutes (indépendantes des canaux) :\n- Domicile (${context.homeTeam}) : ${home}\n- Extérieur (${context.awayTeam}) : ${away}`;
}

function formatTeamSignal(stats: MatchContext["homeTeamStats"] | null): string {
  if (!stats) return "non disponible";
  const extended = formatExtendedTeamSignal(stats);
  return `forme récente ${formatPct(stats.recentForm)}, xG pour ${stats.xgFor.toFixed(2)}, xG contre ${stats.xgAgainst.toFixed(2)}, victoires domicile ${formatPct(stats.homeWinRate)}, victoires extérieur ${formatPct(stats.awayWinRate)}, nuls ${formatPct(stats.drawRate)}, volatilité ligue ${stats.leagueVolatility.toFixed(2)}${extended}`;
}

function formatExtendedTeamSignal(
  stats: NonNullable<MatchContext["homeTeamStats"]>,
): string {
  if (!stats.statisticsMatchCount) return "";
  const metrics = [
    formatOptionalMetric(
      "tirs cadrés pour/contre",
      stats.shotsOnTargetFor,
      stats.shotsOnTargetAgainst,
    ),
    formatOptionalMetric(
      "tirs pour/contre",
      stats.totalShotsFor,
      stats.totalShotsAgainst,
    ),
    formatOptionalMetric(
      "corners pour/contre",
      stats.cornersFor,
      stats.cornersAgainst,
    ),
    formatOptionalMetric(
      "cartons pour/contre",
      stats.cardsFor,
      stats.cardsAgainst,
    ),
    formatOptionalMetric(
      "possession pour/contre",
      stats.possessionFor,
      stats.possessionAgainst,
      "%",
    ),
  ].filter((metric): metric is string => metric !== null);
  return metrics.length > 0
    ? `, statistiques sur ${stats.statisticsMatchCount} match(s) : ${metrics.join(", ")}`
    : "";
}

function formatOptionalMetric(
  label: string,
  valueFor: number | null | undefined,
  valueAgainst: number | null | undefined,
  suffix = "",
): string | null {
  if (valueFor == null || valueAgainst == null) return null;
  return `${label} ${valueFor.toFixed(1)}${suffix}/${valueAgainst.toFixed(1)}${suffix}`;
}

function renderCoachBlock(context: MatchContext): string | null {
  const parts: string[] = [];
  if (context.homeCoach) {
    parts.push(
      `${context.homeTeam} : nouveau coach, ${context.homeCoach.matchesInCharge} match(s) en charge`,
    );
  }
  if (context.awayCoach) {
    parts.push(
      `${context.awayTeam} : nouveau coach, ${context.awayCoach.matchesInCharge} match(s) en charge`,
    );
  }
  if (parts.length === 0) return null;
  return `Continuité du banc : ${parts.join(" ; ")}.`;
}

function renderH2HBlock(context: MatchContext): string | null {
  if (context.h2h === undefined) return null;
  if (context.h2h === null)
    return "Confrontations directes : historique insuffisant (moins de 3 matchs).";
  return `Confrontations directes : score le plus fréquent ${context.h2h.scoreline} (confiance ${formatPct(context.h2h.confidence)}, n=${context.h2h.sampleSize}).`;
}

function renderMarketOddsBlock(context: MatchContext): string | null {
  if (
    context.uncoveredMarketOdds === undefined ||
    context.uncoveredMarketOdds.length === 0
  )
    return null;
  const lines = context.uncoveredMarketOdds.map((m) => {
    // Regression (2026-08-30 code-review retry): this used to render only
    // the French label ("Résultat — domicile 2.1, ...") with no "marché="/
    // "pick=" tags anywhere near it — the one context block the system
    // prompt explicitly allows as a JSON market/pick source, yet the only
    // one that gave the model nothing to copy the technical codes from.
    // Generic per-pick shape since 2026-09-04 (ONE_X_TWO/BTTS/OVER_UNDER,
    // not just ONE_X_TWO) — see market-odds.ts's CONTEXT_MARKET_PICKS.
    const parts = m.prices.map(
      ({ pick, odds }) =>
        `${formatPickForDisplayFr(pick, m.market)} (pick=${pick}) ${odds}`,
    );
    return `marché=${m.market} (${formatMarketForDisplayFr(m.market)}) — ${parts.join(", ")}`;
  });
  return `Marché (prix brut du bookmaker, aucun canal n'a sélectionné ce marché — information de contexte, jamais un signal de valeur) : ${lines.join(" ; ")}.`;
}

function renderExtendedMarketOddsBlock(context: MatchContext): string | null {
  if (!context.extendedMarketOdds?.length) return null;
  const lines = context.extendedMarketOdds.map((market) => {
    const prices = market.prices.map(({ pick, odds, line }) => {
      const lineLabel = line === undefined ? "" : `, ligne=${line}`;
      return `${formatPickForDisplayFr(pick, market.market)} (pick=${pick}${lineLabel}) ${odds}`;
    });
    return `marché=${market.market} (${formatMarketForDisplayFr(market.market)}) — ${prices.join(", ")}`;
  });
  return `Marchés expérimentaux du bookmaker de référence (observation seulement : interdiction de les choisir tant que la ligne, le règlement et la calibration walk-forward ne sont pas activés de bout en bout) : ${lines.join(" ; ")}.`;
}

function formatPct(value: number | null): string {
  if (value === null) return "n/d";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

function formatRatio(value: number | null): string {
  if (value === null) return "n/d";
  return `${value.toFixed(2)}×`;
}

export { SYSTEM_PROMPT };
