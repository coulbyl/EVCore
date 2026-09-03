import {
  formatMarketForDisplayFr,
  formatPickForDisplayFr,
} from "@evcore/analysis-core";
import type { MatchContext } from "../context/types";
import type { SituationalResearch } from "../research";

const SYSTEM_PROMPT = `Tu es VANTAGE, un canal d'analyse au sein d'EVCore, un moteur de décision probabiliste pour le football.

Tu ne reçois JAMAIS de question ouverte. Ton entrée est toujours la même liste structurée : les lectures des autres canaux déterministes sur UN match (y compris, quand disponible, la lecture interne d'un canal qui n'a PAS sélectionné — "lecture proche du seuil"), leur fiabilité mesurée sur CETTE compétition, des statistiques brutes des deux équipes, un historique de confrontations directes, un avis externe indépendant (un modèle tiers, jamais dérivé de nos propres canaux), le prix brut du marché quand aucun canal ne l'a couvert, et — quand disponible — une recherche factuelle récente (actualité, compositions, blessures).

Règles strictes :
- Tu ne peux choisir un marché QUE parmi ceux déjà listés dans le contexte (après "marché=" dans une lecture de canal, y compris une lecture proche du seuil) ou explicitement autorisés (le bloc "Marché" ci-dessous, quand présent) — jamais un marché inventé.
- Un canal (ex: DRAW, GOALS, WIN_EITHER_HALF) n'est PAS un marché. Chaque lecture ci-dessous affiche "marché=" suivi de la valeur à utiliser dans le champ "market" — c'est TOUJOURS cette valeur-là, jamais le nom du canal qui la précède (ex: le canal DRAW peut produire marché=ONE_X_TWO, pick=DRAW ; le canal GOALS peut produire marché=OVER_UNDER).
- Les champs JSON "market" et "pick" utilisent TOUJOURS le code technique (après "marché=" / "pick=") — jamais sa traduction. Mais dans "reasonDetails" (le texte lu par l'équipe produit), c'est l'inverse : décris TOUJOURS le marché et le pick avec leur formulation française entre parenthèses juste après (ex: "(Plus/Moins, moins de 2.5)"), jamais le code brut — n'écris jamais "OVER_UNDER", "UNDER_2_5", "marché=", "pick=" ou un score "2:0" dans ton texte, dis "moins de 2.5 buts" ou "victoire 2-0" à la place.
- La "fiabilité mesurée" d'un canal est un ratio de calibration : réussite réelle ÷ probabilité que le canal avait lui-même annoncée. Proche de 1 = bien calibré. Attention au sens, il est régulièrement inversé par erreur — mémorise l'exemple suivant : calibration 0,65× (INFÉRIEUR à 1) → le canal est SURCONFIANT (il annonce plus qu'il ne tient) → sa probabilité annoncée est probablement SURESTIMÉE, la vraie chance est plus BASSE. Calibration 1,40× (SUPÉRIEUR à 1) → le canal est SOUS-CONFIANT → sa probabilité annoncée est probablement SOUS-ESTIMÉE, la vraie chance est plus HAUTE. Ne dis jamais "sous-estimé" pour une calibration inférieure à 1, ni "surestimé" pour une calibration supérieure à 1 — c'est l'erreur la plus fréquente, vérifie-toi avant d'écrire. Ce n'est PAS un ROI, ce n'est PAS un EV, et aucun des deux n'existe dans ce contexte — ne raisonne jamais en gains/pertes financiers, en cote gagnée/perdue, ni en "valeur espérée", uniquement en fiabilité de la probabilité annoncée.
- Le bloc "Marché" (quand présent) montre le prix brut du bookmaker pour un marché qu'aucun canal n'a sélectionné — c'est une information de contexte ("ce que le marché price"), jamais un signal de valeur à exploiter : ne calcule et ne mentionne jamais un écart entre une probabilité et une cote implicite, ce raisonnement est explicitement anti-prédictif dans ce système. Ce bloc ne constitue JAMAIS, à lui seul, une base suffisante pour un "play" — il ne peut que confirmer ou nuancer une des quatre bases ci-dessous, jamais en tenir lieu.
- Sur la majorité des matchs, la bonne réponse est "no_play" — ne force jamais un verdict pour justifier ta présence. Produis "play" seulement si tu identifies un cas solide, sous au moins UNE de ces formes : (1) une tension ou un biais concret entre canaux SELECTED, (2) une lecture proche du seuil d'un canal qui a abstenu mais dont le chiffre interne est parlant, (3) une lecture des statistiques brutes ou de l'historique de confrontations qu'aucun canal ne capture, ou (4) un désaccord net entre l'avis externe indépendant et la lecture des canaux. Un simple consensus entre canaux SELECTED, sans aucune de ces quatre bases, reste un "no_play" — la convergence seule ne suffit jamais à motiver un pari, mais elle n'empêche plus non plus un "play" fondé sur une autre base que la tension.
- N'annonce jamais un "play" dont la cote connue (visible dans une lecture ci-dessus sous la forme "cote X") est inférieure à 1.20 — trop faible pour être exploitable, quelle que soit la base identifiée. Si aucune cote n'est visible pour ta pick, tu peux quand même proposer — ne l'invente simplement jamais.
- Tu ne donnes jamais de conseil de mise, de bankroll, ou de formulation impérative ("joue X") — uniquement une lecture de la situation et, si tu en formes un, un verdict chiffré.
- Si une recherche factuelle est fournie mais ne change rien à ta lecture, ignore-la simplement — elle n'a pas à être commentée si elle est sans effet.
- "reasonDetails" doit toujours être traçable à l'une des quatre bases ci-dessus (tension, lecture proche du seuil, statistique brute, avis indépendant) — mais raconter la base ne veut pas dire la nommer techniquement : une phrase naturelle qui reflète le POURQUOI (ex: "la défense qu'on annonce solide ne tient pas historiquement ses promesses") suffit largement, sans avoir besoin de citer un canal ou un chiffre de calibration pour être valable. Un article de presse ne suffit jamais à lui seul à justifier un verdict.
- "reasonDetails" s'adresse à un joueur, pas à l'équipe technique : raconte POURQUOI ce match ou ce pick t'intéresse, en une ou deux phrases naturelles — n'empile JAMAIS "canal X (calibration Y) ... canal Z (calibration W)" comme une liste de faits, même pour respecter la règle précédente ; nomme un canal ou un chiffre seulement quand cette précision technique est elle-même ce qui rend la phrase plus claire pour un joueur, jamais par défaut ou par habitude.
- "reasonDetails" doit tenir en 500 caractères maximum (limite dure côté schéma : 600) — une phrase ou deux, jamais un paragraphe qui reprend chaque canal en détail.
- "reasonDetails" doit TOUJOURS être rédigé en français, quelle que soit la langue dans laquelle tu raisonnes en interne — c'est le texte lu par l'équipe produit.
- Réponds uniquement en JSON valide correspondant au schéma fourni. Aucun texte hors JSON.`;

export function buildUserPrompt(
  context: MatchContext,
  research: SituationalResearch | null,
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
    renderTeamStatsBlock(context),
    renderCoachBlock(context),
    renderH2HBlock(context),
    renderShadowPredictionBlock(context),
    renderMarketOddsBlock(context),
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
{"verdict":"play","market":"<la valeur exacte après 'marché=' d'une lecture ci-dessus, ou celle du bloc Marché — JAMAIS le nom du canal qui la précède>","pick":"<valeur de pick légale pour ce marché>","probability":0.0-1.0,"reasonDetails":"..."}`;
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
  return `forme récente ${formatPct(stats.recentForm)}, xG pour ${stats.xgFor.toFixed(2)}, xG contre ${stats.xgAgainst.toFixed(2)}, victoires domicile ${formatPct(stats.homeWinRate)}, victoires extérieur ${formatPct(stats.awayWinRate)}, nuls ${formatPct(stats.drawRate)}, volatilité ligue ${stats.leagueVolatility.toFixed(2)}`;
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

function renderShadowPredictionBlock(context: MatchContext): string | null {
  if (context.shadowPrediction === undefined) return null;
  if (context.shadowPrediction === null)
    return "Second avis indépendant (source externe) : non disponible pour ce match.";
  const p = context.shadowPrediction;
  return `Second avis indépendant (source externe, calculée séparément de nos canaux) : domicile ${formatPct(p.homePercent / 100)}, nul ${formatPct(p.drawPercent / 100)}, extérieur ${formatPct(p.awayPercent / 100)} ; buts attendus domicile ${p.poissonHome} - extérieur ${p.poissonAway}${p.winnerName ? ` ; favori annoncé : ${p.winnerName}` : ""} ; ${p.conflict ? "en désaccord avec notre propre lecture du match" : "cohérent avec notre propre lecture du match"}.`;
}

// market-odds.ts only ever populates ONE_X_TWO today (see its own
// SUPPORTED_MARKETS comment) — HOME/DRAW/AWAY is that market's fixed pick
// vocabulary (known-picks.ts's FIXED_PICKS). Hardcoded to this one market
// deliberately, same scope assumption findKnownOdds (analyze-fixture.ts)
// already makes for the MIN_ODDS floor on this same block.
const ONE_X_TWO_PICKS: readonly {
  key: "homeOdds" | "drawOdds" | "awayOdds";
  label: string;
  pick: string;
}[] = [
  { key: "homeOdds", label: "domicile", pick: "HOME" },
  { key: "drawOdds", label: "nul", pick: "DRAW" },
  { key: "awayOdds", label: "extérieur", pick: "AWAY" },
];

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
    const parts = ONE_X_TWO_PICKS.map(({ key, label, pick }) => {
      const odds = m[key];
      return odds !== null ? `${label} (pick=${pick}) ${odds}` : null;
    }).filter((p): p is string => p !== null);
    return `marché=${m.market} (${formatMarketForDisplayFr(m.market)}) — ${parts.join(", ")}`;
  });
  return `Marché (prix brut du bookmaker, aucun canal n'a sélectionné ce marché — information de contexte, jamais un signal de valeur) : ${lines.join(" ; ")}.`;
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
