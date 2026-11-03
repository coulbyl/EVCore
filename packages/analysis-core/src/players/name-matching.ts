// Player name matching (plan des stratégies, phase 3, step 2).
//
// The odds name players ("Benjamin Sesko"), never with an id; the squads and
// the match statistics name them their own way ("B. Šeško", "Lisandro
// Martínez"). On 455 priced players of the 03/11 sample, matching on the
// last name alone left 26 % unmatched — hence the squads, and this function.
//
// Each squad player carries every spelling we know of him (the squad's, the
// match statistics'). The rules run from strict to loose; the first one that
// finds anybody decides: one player is a match, two or more is ambiguous and
// stays unmatched — a wrong player would settle someone else's bet.

export type SquadCandidate = {
  playerExternalId: number;
  /** Every known spelling: squad name, `player.name`, … */
  names: readonly string[];
};

export type PlayerNameMatch =
  | { status: "matched"; playerExternalId: number }
  | { status: "unmatched" }
  | { status: "ambiguous"; playerExternalIds: number[] };

type Rule = (priced: string[], known: string[]) => boolean;

/** Letters NFD does not decompose. */
const LETTER_FOLDS: Readonly<Record<string, string>> = {
  ø: "o",
  æ: "ae",
  œ: "oe",
  ß: "ss",
  đ: "d",
  ð: "d",
  ł: "l",
  ı: "i",
  þ: "th",
};

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  quot: '"',
  lt: "<",
  gt: ">",
  nbsp: " ",
};

/**
 * Undoes the provider's two text faults, seen in the squads of 03/11:
 * HTML entities ("N. O&apos;Reilly") and UTF-8 read as Latin-1
 * ("A. MaksimoviÄ\u0087" for "A. Maksimović"). A string that does not decode
 * as UTF-8 is left as it is.
 */
export function repairProviderText(text: string): string {
  const decoded = text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (entity, body: string) => {
      const lower = body.toLowerCase();
      if (lower.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
      }
      if (lower.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
      }
      return HTML_ENTITIES[lower] ?? entity;
    },
  );
  if (!/[\u00c2-\u00f4][\u0080-\u00bf]/.test(decoded)) return decoded;
  if ([...decoded].some((char) => char.charCodeAt(0) > 0xff)) return decoded;
  try {
    const bytes = Uint8Array.from([...decoded].map((c) => c.charCodeAt(0)));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return decoded;
  }
}

/**
 * Lower case, accents and folded letters, apostrophes dropped ("N'Dicka" →
 * "ndicka"), dots, hyphens and commas as spaces ("Thomas-Asante" →
 * "thomas asante").
 */
export function normalizePlayerName(name: string): string[] {
  const folded = repairProviderText(name)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[øæœßđðłıþ]/g, (letter) => LETTER_FOLDS[letter] ?? letter)
    .replace(/['’`´]/g, "")
    .replace(/[.\-_,]/g, " ");
  return folded.split(/\s+/).filter((token) => token.length > 0);
}

const sameTokens = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((token, index) => token === b[index]);

const endsWith = (tokens: readonly string[], tail: readonly string[]) =>
  tail.length > 0 &&
  tokens.length >= tail.length &&
  sameTokens(tokens.slice(tokens.length - tail.length), tail);

/** "K. Mbappe" against "Kylian Mbappe": initial, then the whole surname. */
function initialAndSurname(
  abbreviated: readonly string[],
  full: readonly string[],
): boolean {
  const [initial, ...surname] = abbreviated;
  if (initial === undefined || initial.length !== 1) return false;
  const [first] = full;
  return (
    first !== undefined &&
    first.length > 1 &&
    full.length > surname.length &&
    first.startsWith(initial) &&
    endsWith(full, surname)
  );
}

const exact: Rule = (priced, known) => sameTokens(priced, known);

/**
 * Initial + surname either way, or both full names sharing their first and
 * last token ("Dermot Mee" / "Dermot William Mee").
 */
const compatible: Rule = (priced, known) => {
  if (initialAndSurname(known, priced) || initialAndSurname(priced, known)) {
    return true;
  }
  if (priced.length < 2 || known.length < 2) return false;
  const [pricedFirst] = priced;
  const [knownFirst] = known;
  if (pricedFirst === undefined || knownFirst === undefined) return false;
  if (pricedFirst.length === 1 || knownFirst.length === 1) return false;
  return pricedFirst === knownFirst && priced.at(-1) === known.at(-1);
};

/**
 * Same last token, first names one a prefix of the other ("Nico" /
 * "Nicolas", "Dani" / "Daniel").
 */
const shortFirstName: Rule = (priced, known) => {
  if (priced.length < 2 || known.length < 2) return false;
  const [pricedFirst] = priced;
  const [knownFirst] = known;
  if (pricedFirst === undefined || knownFirst === undefined) return false;
  if (Math.min(pricedFirst.length, knownFirst.length) < 3) return false;
  return (
    priced.at(-1) === known.at(-1) &&
    (pricedFirst.startsWith(knownFirst) || knownFirst.startsWith(pricedFirst))
  );
};

/**
 * One single-word name ("Casemiro", "Rodrygo") against the first or last
 * word of the other.
 */
const singleWord: Rule = (priced, known) => {
  const [single, other] =
    priced.length === 1 ? [priced[0], known] : [known[0], priced];
  if (single === undefined || (priced.length !== 1 && known.length !== 1)) {
    return false;
  }
  if (other.length < 2) return false;
  return other[0] === single || other.at(-1) === single;
};

const RULES: readonly Rule[] = [exact, compatible, shortFirstName, singleWord];

export function matchPlayerName(
  name: string,
  squad: readonly SquadCandidate[],
): PlayerNameMatch {
  const priced = normalizePlayerName(name);
  if (priced.length === 0) return { status: "unmatched" };
  const known = squad.map((candidate) => ({
    id: candidate.playerExternalId,
    spellings: candidate.names
      .map(normalizePlayerName)
      .filter((tokens) => tokens.length > 0),
  }));

  for (const rule of RULES) {
    const ids = new Set(
      known
        .filter((candidate) =>
          candidate.spellings.some((spelling) => rule(priced, spelling)),
        )
        .map((candidate) => candidate.id),
    );
    if (ids.size === 1) {
      const [playerExternalId] = [...ids];
      if (playerExternalId !== undefined) {
        return { status: "matched", playerExternalId };
      }
    }
    if (ids.size > 1) {
      return {
        status: "ambiguous",
        playerExternalIds: [...ids].sort((a, b) => a - b),
      };
    }
  }
  return { status: "unmatched" };
}

/** `P<externalId>`: the pick of a player market. */
export function playerPick(playerExternalId: number): string {
  return `P${playerExternalId}`;
}

/** The player id a `P<externalId>` pick names, or null for any other pick. */
export function playerIdOfPick(pick: string): number | null {
  const matched = /^P([1-9]\d*)$/.exec(pick);
  return matched?.[1] === undefined ? null : Number(matched[1]);
}

/** "No Goalscorer" on the first-scorer market. */
export const NO_GOALSCORER_PICK = "NONE";
