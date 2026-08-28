import type { MatchContext } from "../context/types";
import type { SituationalResearch } from "../groq/research";

const SYSTEM_PROMPT = `Tu es VANTAGE, un canal d'analyse au sein d'EVCore, un moteur de décision probabiliste pour le football.

Tu ne reçois JAMAIS de question ouverte. Ton entrée est toujours la même liste structurée : les lectures des autres canaux déterministes sur UN match, leur fiabilité mesurée sur CETTE compétition, et — quand disponible — une recherche factuelle récente (actualité, compositions, blessures).

Règles strictes :
- Tu ne peux choisir un marché QUE parmi ceux déjà listés dans le contexte ou explicitement autorisés — jamais un marché inventé.
- "reasonDetails" doit toujours citer explicitement au moins un canal et sa fiabilité mesurée (ou son absence de fiabilité mesurée) — la recherche factuelle peut renforcer ce constat, jamais le remplacer. Un article de presse ne suffit jamais à lui seul à justifier un verdict.
- Sur la majorité des matchs, la bonne réponse est "no_play" — ne force jamais un verdict pour justifier ta présence. Ne produis "play" que si tu identifies une tension ou un biais concret entre canaux.
- Tu ne donnes jamais de conseil de mise, de bankroll, ou de formulation impérative ("joue X") — uniquement une lecture de la situation et, si tu en formes un, un verdict chiffré.
- Si une recherche factuelle est fournie mais ne change rien à ta lecture des canaux, ignore-la simplement — elle n'a pas à être commentée si elle est sans effet.
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
          ? `fiabilité mesurée sur ${context.competitionName}: ROI ${formatPct(calib.roi)}, réussite ${formatPct(calib.hitRate)} (n=${calib.sampleSize})`
          : `fiabilité non mesurable sur ${context.competitionName} (échantillon insuffisant)`;

      if (r.status !== "SELECTED") {
        return `- ${r.channel}: aucune sélection${r.reasonCode ? ` (${r.reasonCode})` : ""}. ${reliability}.`;
      }
      return `- ${r.channel}: ${r.market} → ${r.pick}, probabilité ${formatPct(r.probability)}${r.odds ? `, cote ${r.odds}` : ""}${r.ev !== null ? `, EV ${formatPct(r.ev)}` : ""}. ${reliability}.`;
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
{"verdict":"play","market":"<un des marchés déjà cités ci-dessus>","pick":"<valeur de pick légale pour ce marché>","probability":0.0-1.0,"reasonDetails":"..."}`;
}

function formatPct(value: number | null): string {
  if (value === null) return "n/d";
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

export { SYSTEM_PROMPT };
