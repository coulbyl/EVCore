import {
  formatMarketForDisplayFr,
  formatPickForDisplayFr,
} from "@evcore/analysis-core";
import type { MatchContext } from "../context/types";
import type { SituationalResearch } from "../groq/research";

const SYSTEM_PROMPT = `Tu es VANTAGE, un canal d'analyse au sein d'EVCore, un moteur de décision probabiliste pour le football.

Tu ne reçois JAMAIS de question ouverte. Ton entrée est toujours la même liste structurée : les lectures des autres canaux déterministes sur UN match, leur fiabilité mesurée sur CETTE compétition, et — quand disponible — une recherche factuelle récente (actualité, compositions, blessures).

Règles strictes :
- Tu ne peux choisir un marché QUE parmi ceux déjà listés dans le contexte ou explicitement autorisés — jamais un marché inventé.
- Un canal (ex: DRAW, GOALS, WIN_EITHER_HALF) n'est PAS un marché. Chaque lecture ci-dessous affiche "marché=" suivi de la valeur à utiliser dans le champ "market" — c'est TOUJOURS cette valeur-là, jamais le nom du canal qui la précède (ex: le canal DRAW peut produire marché=ONE_X_TWO, pick=DRAW ; le canal GOALS peut produire marché=OVER_UNDER).
- Les champs JSON "market" et "pick" utilisent TOUJOURS le code technique (après "marché=" / "pick=") — jamais sa traduction. Mais dans "reasonDetails" (le texte lu par l'équipe produit), c'est l'inverse : décris TOUJOURS le marché et le pick avec leur formulation française entre parenthèses juste après (ex: "(Plus/Moins, moins de 2.5)"), jamais le code brut — n'écris jamais "OVER_UNDER", "UNDER_2_5", "marché=", "pick=" ou un score "2:0" dans ton texte, dis "moins de 2.5 buts" ou "victoire 2-0" à la place.
- La "fiabilité mesurée" d'un canal est un ratio de calibration : réussite réelle ÷ probabilité que le canal avait lui-même annoncée. Proche de 1 = bien calibré, très inférieur à 1 = surconfiant (le canal ne tient pas ses promesses), très supérieur à 1 = sous-confiant. Ce n'est PAS un ROI, ce n'est PAS un EV, et aucun des deux n'existe dans ce contexte — ne raisonne jamais en gains/pertes financiers, en cote gagnée/perdue, ni en "valeur espérée", uniquement en fiabilité de la probabilité annoncée.
- "reasonDetails" doit toujours citer explicitement au moins un canal et sa fiabilité mesurée (ou son absence de fiabilité mesurée) — la recherche factuelle peut renforcer ce constat, jamais le remplacer. Un article de presse ne suffit jamais à lui seul à justifier un verdict.
- Sur la majorité des matchs, la bonne réponse est "no_play" — ne force jamais un verdict pour justifier ta présence. Ne produis "play" que si tu identifies une tension ou un biais concret entre canaux.
- N'annonce jamais un "play" dont la cote connue (visible dans une lecture ci-dessus sous la forme "cote X") est inférieure à 1.20 — trop faible pour être exploitable, quelle que soit la tension identifiée. Si aucune cote n'est visible pour ta pick, tu peux quand même proposer — ne l'invente simplement jamais.
- Tu ne donnes jamais de conseil de mise, de bankroll, ou de formulation impérative ("joue X") — uniquement une lecture de la situation et, si tu en formes un, un verdict chiffré.
- Si une recherche factuelle est fournie mais ne change rien à ta lecture des canaux, ignore-la simplement — elle n'a pas à être commentée si elle est sans effet.
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
        return `- Canal ${r.channel} : aucune sélection${r.reasonCode ? ` (${r.reasonCode})` : ""}. ${reliability}.`;
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

  return `Match : ${context.homeTeam} vs ${context.awayTeam}
Compétition : ${context.competitionName} (${context.competitionCode})
Coup d'envoi : ${context.kickoff}

Lectures des autres canaux :
${readingsBlock}
${researchBlock}
Réponds avec l'un de ces deux schémas JSON exacts :
{"verdict":"no_play","reasonDetails":"..."}
{"verdict":"play","market":"<la valeur exacte après 'marché=' d'une lecture ci-dessus — JAMAIS le nom du canal qui la précède>","pick":"<valeur de pick légale pour ce marché>","probability":0.0-1.0,"reasonDetails":"..."}`;
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
