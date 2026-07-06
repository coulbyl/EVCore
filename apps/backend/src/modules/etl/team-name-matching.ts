// Pure team-name fuzzy matching — no NestJS/BullMQ dependency so it can be
// imported from standalone scripts (e.g. scripts/audit-team-name-mismatches.ts)
// without pulling in decorator-based worker classes.

/**
 * Normalize a team name for fuzzy matching: strip accents, lowercase,
 * remove common suffixes (FC, CF, SC, etc.), and normalize separators.
 */
export function normalizeTeam(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[øØ]/g, 'o')
    .replace(/[łŁ]/g, 'l')
    .replace(/[đĐ]/g, 'd')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[œŒ]/g, 'oe')
    .replace(/ß/g, 'ss')
    .replace(/([A-Za-z])\./g, '$1')
    .toLowerCase()
    .replace(/\butd\b/g, 'united')
    .replace(/\b(fc|afc|cf|sc|ac|ss|as|ff|if|bk|aif|bois|ik)\b/g, '')
    .replace(/[.\-'/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Maps normalized DB names to additional normalized forms used by The Odds API.
// Needed when the API name shares no prefix/suffix with the DB name.
const TEAM_ALIASES: Record<string, string[]> = {
  // PL
  wolves: ['wolverhampton wanderers', 'wolverhampton'],
  // BL1 / D2
  'bayern munchen': ['bayern munich'],
  '1899 hoffenheim': ['tsg hoffenheim', 'hoffenheim'],
  '1 heidenheim': ['heidenheim'],
  'hertha bsc': ['hertha berlin'],
  // D2
  'sv wehen': ['wehen wiesbaden'],
  // SP2
  'racing ferrol': ['racing de ferrol'],
  'racing santander': ['real racing club de santander', 'real racing club'],
  'real sociedad ii': ['real sociedad b'],
  // L1 / F2
  'stade brestois 29': ['brest'],
  laval: ['stade lavallois'],
  quevilly: ['us quevilly rouen'],
  // I2
  catanzaro: ['us catanzaro 1929'],
  lecco: ['lecce'],
  // CH
  'west brom': ['west bromwich albion', 'west bromwich'],
  qpr: ['queens park rangers'],
  // EL1 / EL2
  'accrington st': ['accrington stanley'],
  // POR
  'sporting cp': ['sporting lisbon', 'sporting'],
  guimaraes: ['vitoria sc', 'vitoria'],
  // LL — DB stores "Athletic Club", API uses "Athletic Bilbao"
  'athletic club': ['athletic bilbao', 'athletic'],
  // J1
  'sanfrecce hiroshima': ['hiroshima sanfrecce'],
  'kyoto sanga': ['kyoto purple sanga'],
  // BRA1 — API uses regional suffix or full state name
  'rb bragantino': ['bragantino sp'],
  'atletico mg': ['atletico mineiro'],
  // CSL — clubs rebranded or translated between seasons
  'beijing guoan': ['beijing sinobo guoan'],
  'chengdu better city': ['chengdu rongcheng'],
  'dalian aerbin': ['dalian professional'],
  'dalian zhixing': ['dalian yingbo'],
  'meizhou kejia': ['meizhou hakka'],
  'qingdao youth island': ['qingdao west coast'],
  'qingdao jonoon': ['qingdao hainiu'],
  'shandong luneng': ['shandong taishan'],
  // FIN1 — abbreviations and reordered names
  eif: ['ekenas'],
  kooteepee: ['ktp'],
  'turku ps': ['tps turku'],
};

export function teamMatches(
  team: { name: string; shortName: string },
  eventName: string,
): boolean {
  const norm = normalizeTeam(eventName);
  const n = normalizeTeam(team.name);
  const candidates = [
    n,
    normalizeTeam(team.shortName),
    ...(TEAM_ALIASES[n] ?? []),
  ];

  return candidates.some((c) => namesEquivalent(c, norm));
}

function namesEquivalent(left: string, right: string): boolean {
  if (
    left === right ||
    left.startsWith(`${right} `) ||
    right.startsWith(`${left} `) ||
    left.endsWith(` ${right}`) ||
    right.endsWith(` ${left}`)
  ) {
    return true;
  }

  const stripTrailingS = (value: string): string =>
    value.endsWith('s') ? value.slice(0, -1) : value;

  return (
    stripTrailingS(left) === right ||
    stripTrailingS(right) === left ||
    stripTrailingS(left) === stripTrailingS(right)
  );
}
