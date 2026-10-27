import { formatMarketForDisplayFr, Market } from "@evcore/analysis-core";

/**
 * Nettoyage déterministe du texte lu par le joueur.
 *
 * Le prompt interdit les codes techniques et le jargon de calibration dans
 * "reasonDetails", et le modèle les laisse quand même passer : mesuré le
 * 2026-10-13 sur 8 189 verdicts « play », 36 % des textes contenaient un
 * code de marché, le mot « canal » ou un ratio de calibration brut (24 %
 * sur les 173 plus récents, après le durcissement du prompt du 09-07).
 * Rejeter la réponse ferait perdre le verdict pour un défaut de forme ;
 * on corrige la forme, déterministiquement, et on laisse le verdict.
 *
 * Trois familles de remplacement, dans cet ordre :
 *  1. les codes de pick connus (« UNDER_2_5 », « OVER_1_5 »…) → leur libellé
 *     français ;
 *  2. les codes de marché (« OVER_UNDER », « BTTS »…) → leur libellé ;
 *  3. le jargon interne : « le canal X », « calibration 0,65× », « n=42 »,
 *     « marché= », « pick= » → langage courant ou suppression.
 * Les espaces sont ensuite normalisés. Rien d'autre n'est touché : le
 * sens de la phrase reste celui du modèle.
 */

const MARKET_CODES = Object.values(Market) as string[];

/** Codes de pick dont le libellé ne dépend pas du marché. */
const PICK_LABELS: Record<string, string> = {
  OVER_0_5: "plus de 0,5 but",
  UNDER_0_5: "moins de 0,5 but",
  OVER_1_5: "plus de 1,5 but",
  UNDER_1_5: "moins de 1,5 but",
  OVER_2_5: "plus de 2,5 buts",
  UNDER_2_5: "moins de 2,5 buts",
  OVER_3_5: "plus de 3,5 buts",
  UNDER_3_5: "moins de 3,5 buts",
  OVER_4_5: "plus de 4,5 buts",
  UNDER_4_5: "moins de 4,5 buts",
};

const CHANNEL_WORDS = [
  "DOMINANT",
  "VALUE",
  "SAFE",
  "GOALS",
  "FIRST_HALF",
  "DRAW_NO_BET",
  "DRAW",
  "BTTS",
  "CONSENSUS",
  "CONTRARIAN",
  "AVOID",
  "UNDERDOG",
  "FAVORITE",
  "LIVE_VALUE",
  "MARKET_MOVE",
  "WIN_TO_NIL",
  "CLEAN_SHEET",
  "TEAM_TOTAL",
  "WIN_EITHER_HALF",
  "DOUBLE_CHANCE",
  "CORRECT_SCORE",
  "OVER_UNDER_HT",
  "HALF_TIME_FULL_TIME",
  "RESULT_TOTAL_GOALS",
  "RESULT_BTTS",
  "VANTAGE",
];

/**
 * Verbes au présent que le modèle (ou le remplacement du mot « canal »)
 * met au singulier après « nos données internes » : « nos données internes
 * montre » est la faute la plus fréquente des textes v4 (relevé du
 * 2026-10-27). Singulier → pluriel, liste fermée pour ne jamais toucher un
 * mot qui n'est pas un verbe.
 */
const PLURAL_VERBS: Record<string, string> = {
  est: "sont",
  a: "ont",
  montre: "montrent",
  indique: "indiquent",
  prévoit: "prévoient",
  suggère: "suggèrent",
  affiche: "affichent",
  annonce: "annoncent",
  estime: "estiment",
  donne: "donnent",
  place: "placent",
  voit: "voient",
  signale: "signalent",
  penche: "penchent",
  privilégie: "privilégient",
  anticipe: "anticipent",
  évalue: "évaluent",
  reste: "restent",
  tient: "tiennent",
  soutient: "soutiennent",
  pense: "pensent",
  juge: "jugent",
  considère: "considèrent",
  repère: "repèrent",
  relève: "relèvent",
  laisse: "laissent",
  fait: "font",
  va: "vont",
  dit: "disent",
  pointe: "pointent",
  accorde: "accordent",
  attribue: "attribuent",
  calcule: "calculent",
  projette: "projettent",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Code brut → libellé, avec un libellé de marché si le code en est un. */
function marketLabel(code: string): string {
  return formatMarketForDisplayFr(code as Market).toLowerCase();
}

export function sanitizeReasonText(text: string): string {
  let out = text;

  // « marché=X », « pick=Y », « ligne=Z » : balises de contexte recopiées.
  out = out.replace(/\b(marché|pick|ligne)\s*=\s*/gi, "");

  // « les lectures des canaux » devenait « les lectures de nos lectures ».
  out = out.replace(
    /\b(?:les |des )?lectures (?:des|de nos) canaux\b/gi,
    "nos lectures",
  );

  // « respectant les contraintes de cote », « conforme aux contraintes » :
  // une consigne du prompt recopiée, qui n'a rien à faire devant un joueur
  // (52 textes depuis le 13/10).
  out = out.replace(
    /,?\s*(?:qui |et )?(?:respectant|respecte|respectent|conformes? aux|dans le respect des|dans les|dans le cadre des)\s+(?:nos |les |des )?contraintes(?:\s+de\s+cote)?/gi,
    "",
  );
  out = out.replace(
    /,?\s*(?:dans|hors)\s+(?:les|des)\s+limites\s+autorisées/gi,
    "",
  );
  // Quand la contrainte EST la raison de l'abstention, la phrase en a besoin :
  // on la dit en clair au lieu de la supprimer.
  out = out
    .replace(
      /\b(?:les|la|des|aux) contraintes? de cote\b/gi,
      "notre fourchette de cote",
    )
    .replace(/\bcontraintes? de cote\b/gi, "fourchette de cote");

  // « le signal DOMINANT », « le signal BTTS » → « un de nos signaux » : le
  // remplacement générique plus bas donnait « le signal nos données
  // internes est ».
  out = out.replace(
    new RegExp(
      `\\b(?:le |un |du )?signal\\s+(?:${CHANNEL_WORDS.map(escapeRegExp).join("|")})\\b`,
      "gi",
    ),
    "un de nos signaux",
  );

  // « le canal DRAW », « canal BTTS (calibration 0,65×) » → nos données.
  const channelAlternation = CHANNEL_WORDS.map(escapeRegExp).join("|");
  out = out.replace(
    new RegExp(
      `\\b(?:le |du |un |notre )?canal\\s+(?:${channelAlternation})\\b(?:\\s*\\((?:calibration|fiabilité)[^)]*\\))?`,
      "gi",
    ),
    "nos données internes",
  );
  // Picks à ligne (OVER_2_5…), avant les marchés pour que « OVER_UNDER »
  // ne mange pas « OVER_2_5 ».
  for (const [code, label] of Object.entries(PICK_LABELS)) {
    out = out.replace(new RegExp(`\\b${escapeRegExp(code)}\\b`, "g"), label);
  }

  // Codes de marché, du plus long au plus court (CLEAN_SHEET_HOME avant
  // CLEAN_SHEET).
  for (const code of [...MARKET_CODES].sort((a, b) => b.length - a.length)) {
    out = out.replace(
      new RegExp(`\\b${escapeRegExp(code)}\\b`, "g"),
      marketLabel(code),
    );
  }

  // Picks de résultat quand ils restent collés à un marché déjà traduit.
  out = out
    .replace(/\bHOME\b/g, "domicile")
    .replace(/\bAWAY\b/g, "extérieur")
    .replace(/\bYES\b/g, "oui")
    .replace(/\bNO\b/g, "non");

  // Un code de canal resté seul.
  out = out.replace(
    new RegExp(`\\b(?:${channelAlternation})\\b`, "g"),
    "nos données internes",
  );
  // Le mot « canal » lui-même, quand il reste.
  out = out
    .replace(/\bles canaux\b/gi, "nos lectures")
    .replace(/\bdes canaux\b/gi, "de nos lectures")
    .replace(/\baux canaux\b/gi, "à nos lectures")
    .replace(/\bcanaux\b/gi, "lectures")
    .replace(/\b(?:le |un |ce |du )?canal\b/gi, "notre lecture");

  // « (calibration 0,65×, n=42) », « calibration 1,2x », « n=38 ».
  out = out
    .replace(/\(\s*(?:calibration|fiabilité)[^)]*\)/gi, "")
    .replace(
      /\bcalibration\s+(?:de\s+)?\d+(?:[.,]\d+)?\s*[×x]?/gi,
      "fiabilité mesurée",
    )
    .replace(/\(?\bn\s*=\s*\d+\)?/g, "");

  // Accord du verbe qui suit « nos données internes ».
  out = out.replace(
    /(?<!signal )\b(nos données internes)\s+(\p{L}+)/giu,
    (match, subject: string, verb: string) => {
      const plural = PLURAL_VERBS[verb.toLowerCase()];
      return plural ? `${subject} ${plural}` : match;
    },
  );
  out = out.replace(
    /\b(?:les |des )?lectures de nos lectures\b/gi,
    "nos lectures",
  );

  return (
    out
      .replace(/\s+([,.;:!?])/g, "$1")
      .replace(/\(\s*\)/g, "")
      .replace(/[ \t]{2,}/g, " ")
      .replace(/\s+\n/g, "\n")
      .trim()
      // Un remplacement en tête de phrase laissait une minuscule (« nos
      // données internes sont… » en début de texte).
      .replace(
        /(^|[.!?]\s+)(\p{Ll})/gu,
        (_m, lead: string, letter: string) => `${lead}${letter.toUpperCase()}`,
      )
  );
}
