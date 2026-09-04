export type Competition = {
  code: string;
  name: string;
  country: string;
};

/** Liste des compétitions actives — source de vérité : packages/db/src/seed.ts.
 * Traduction française : lib/competition-i18n.ts (translateCompetition), pas
 * dupliquée ici — un seul point de traduction pour toute l'app. */
export const COMPETITIONS: Competition[] = [
  // ── Angleterre ──────────────────────────────────────────────────────────────
  { code: "PL", name: "Premier League", country: "England" },
  { code: "CH", name: "Championship", country: "England" },
  { code: "EL1", name: "League One", country: "England" },
  { code: "EL2", name: "League Two", country: "England" },
  // ── Italie ──────────────────────────────────────────────────────────────────
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "I2", name: "Serie B", country: "Italy" },
  // ── Espagne ─────────────────────────────────────────────────────────────────
  { code: "LL", name: "La Liga", country: "Spain" },
  { code: "SP2", name: "Segunda Division", country: "Spain" },
  // ── Allemagne ───────────────────────────────────────────────────────────────
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "D2", name: "2. Bundesliga", country: "Germany" },
  // ── France ──────────────────────────────────────────────────────────────────
  { code: "L1", name: "Ligue 1", country: "France" },
  { code: "F2", name: "Ligue 2", country: "France" },
  // ── Pays-Bas ────────────────────────────────────────────────────────────────
  { code: "ERD", name: "Eredivisie", country: "Netherlands" },
  // ── Portugal ────────────────────────────────────────────────────────────────
  { code: "POR", name: "Primeira Liga", country: "Portugal" },
  // ── Turquie ─────────────────────────────────────────────────────────────────
  { code: "TUR1", name: "Süper Lig", country: "Turkey" },
  { code: "TUR2", name: "1. Lig", country: "Turkey" },
  // ── Suisse ──────────────────────────────────────────────────────────────────
  { code: "SUI1", name: "Super League", country: "Switzerland" },
  { code: "SUI2", name: "Challenge League", country: "Switzerland" },
  // ── Norvège ─────────────────────────────────────────────────────────────────
  { code: "NOR1", name: "Eliteserien", country: "Norway" },
  { code: "NOR2", name: "1. Division", country: "Norway" },
  // ── Suède ───────────────────────────────────────────────────────────────────
  { code: "SWE1", name: "Allsvenskan", country: "Sweden" },
  { code: "SWE2", name: "Superettan", country: "Sweden" },
  // ── Pologne ─────────────────────────────────────────────────────────────────
  { code: "POL1", name: "Ekstraklasa", country: "Poland" },
  { code: "POL2", name: "I Liga", country: "Poland" },
  // ── Brésil ──────────────────────────────────────────────────────────────────
  { code: "BRA1", name: "Brasileirão Série A", country: "Brazil" },
  // ── Japon ───────────────────────────────────────────────────────────────────
  { code: "J1", name: "J1 League", country: "Japan" },
  // ── Corée du Sud ────────────────────────────────────────────────────────────
  { code: "KOR1", name: "K League 1", country: "South-Korea" },
  // ── États-Unis ──────────────────────────────────────────────────────────────
  { code: "MLS", name: "Major League Soccer", country: "USA" },
  // ── Mexique ─────────────────────────────────────────────────────────────────
  { code: "MX1", name: "Liga MX", country: "Mexico" },
  // ── Chine ───────────────────────────────────────────────────────────────────
  { code: "CSL", name: "Super League", country: "China" },
  // ── Rép. Tchèque ────────────────────────────────────────────────────────────
  { code: "CZE1", name: "Czech Liga", country: "Czech Republic" },
  // ── Serbie ──────────────────────────────────────────────────────────────────
  { code: "SRB1", name: "Super Liga", country: "Serbia" },
  // ── Slovénie ────────────────────────────────────────────────────────────────
  { code: "SVN1", name: "1. SNL", country: "Slovenia" },
  // ── Estonie ─────────────────────────────────────────────────────────────────
  { code: "EST1", name: "Meistriliiga", country: "Estonia" },
  // ── Finlande ────────────────────────────────────────────────────────────────
  { code: "FIN1", name: "Veikkausliiga", country: "Finland" },
  // ── Islande ─────────────────────────────────────────────────────────────────
  { code: "ISL1", name: "Úrvalsdeild", country: "Iceland" },
  // ── Lettonie ────────────────────────────────────────────────────────────────
  { code: "LAT1", name: "Virsliga", country: "Latvia" },
  // ── Europe (coupes) ─────────────────────────────────────────────────────────
  { code: "UCL", name: "Champions League", country: "Europe" },
  { code: "UEL", name: "UEFA Europa League", country: "Europe" },
  {
    code: "UECL",
    name: "UEFA Europa Conference League",
    country: "Europe",
  },
  // ── International ───────────────────────────────────────────────────────────
  { code: "WC", name: "FIFA World Cup", country: "World" },
  { code: "WCQE", name: "World Cup Qualification - Europe", country: "World" },
  { code: "UNL", name: "UEFA Nations League", country: "World" },
  { code: "FRI", name: "International Friendlies", country: "World" },
];
