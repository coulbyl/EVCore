export type Competition = {
  code: string;
  name: string;
  nameFr: string;
  country: string;
};

/** Liste des compétitions actives — source de vérité : packages/db/src/seed.ts */
export const COMPETITIONS: Competition[] = [
  // ── Angleterre ──────────────────────────────────────────────────────────────
  {
    code: "PL",
    name: "Premier League",
    nameFr: "Premier League",
    country: "England",
  },
  {
    code: "CH",
    name: "Championship",
    nameFr: "Championship",
    country: "England",
  },
  { code: "EL1", name: "League One", nameFr: "League One", country: "England" },
  { code: "EL2", name: "League Two", nameFr: "League Two", country: "England" },
  // ── Italie ──────────────────────────────────────────────────────────────────
  { code: "SA", name: "Serie A", nameFr: "Série A", country: "Italy" },
  { code: "I2", name: "Serie B", nameFr: "Série B", country: "Italy" },
  // ── Espagne ─────────────────────────────────────────────────────────────────
  { code: "LL", name: "La Liga", nameFr: "La Liga", country: "Spain" },
  {
    code: "SP2",
    name: "Segunda Division",
    nameFr: "Segunda División",
    country: "Spain",
  },
  // ── Allemagne ───────────────────────────────────────────────────────────────
  { code: "BL1", name: "Bundesliga", nameFr: "Bundesliga", country: "Germany" },
  {
    code: "D2",
    name: "2. Bundesliga",
    nameFr: "2. Bundesliga",
    country: "Germany",
  },
  // ── France ──────────────────────────────────────────────────────────────────
  { code: "L1", name: "Ligue 1", nameFr: "Ligue 1", country: "France" },
  { code: "F2", name: "Ligue 2", nameFr: "Ligue 2", country: "France" },
  // ── Pays-Bas ────────────────────────────────────────────────────────────────
  {
    code: "ERD",
    name: "Eredivisie",
    nameFr: "Eredivisie",
    country: "Netherlands",
  },
  // ── Portugal ────────────────────────────────────────────────────────────────
  {
    code: "POR",
    name: "Primeira Liga",
    nameFr: "Liga Portugal",
    country: "Portugal",
  },
  // ── Turquie ─────────────────────────────────────────────────────────────────
  { code: "TUR1", name: "Süper Lig", nameFr: "Süper Lig", country: "Turkey" },
  { code: "TUR2", name: "1. Lig", nameFr: "1. Lig", country: "Turkey" },
  // ── Suisse ──────────────────────────────────────────────────────────────────
  {
    code: "SUI1",
    name: "Super League",
    nameFr: "Super League",
    country: "Switzerland",
  },
  {
    code: "SUI2",
    name: "Challenge League",
    nameFr: "Challenge League",
    country: "Switzerland",
  },
  // ── Norvège ─────────────────────────────────────────────────────────────────
  {
    code: "NOR1",
    name: "Eliteserien",
    nameFr: "Eliteserien",
    country: "Norway",
  },
  {
    code: "NOR2",
    name: "1. Division",
    nameFr: "1. Division",
    country: "Norway",
  },
  // ── Suède ───────────────────────────────────────────────────────────────────
  {
    code: "SWE1",
    name: "Allsvenskan",
    nameFr: "Allsvenskan",
    country: "Sweden",
  },
  { code: "SWE2", name: "Superettan", nameFr: "Superettan", country: "Sweden" },
  // ── Pologne ─────────────────────────────────────────────────────────────────
  {
    code: "POL1",
    name: "Ekstraklasa",
    nameFr: "Ekstraklasa",
    country: "Poland",
  },
  { code: "POL2", name: "I Liga", nameFr: "I Liga", country: "Poland" },
  // ── Brésil ──────────────────────────────────────────────────────────────────
  {
    code: "BRA1",
    name: "Brasileirão",
    nameFr: "Brasileirão",
    country: "Brazil",
  },
  // ── Japon ───────────────────────────────────────────────────────────────────
  { code: "J1", name: "J1 League", nameFr: "J1 League", country: "Japan" },
  // ── Corée du Sud ────────────────────────────────────────────────────────────
  {
    code: "KOR1",
    name: "K League 1",
    nameFr: "K League 1",
    country: "South-Korea",
  },
  // ── États-Unis ──────────────────────────────────────────────────────────────
  { code: "MLS", name: "Major League Soccer", nameFr: "MLS", country: "USA" },
  // ── Mexique ─────────────────────────────────────────────────────────────────
  { code: "MX1", name: "Liga MX", nameFr: "Liga MX", country: "Mexico" },
  // ── Chine ───────────────────────────────────────────────────────────────────
  {
    code: "CSL",
    name: "Super League",
    nameFr: "Super League",
    country: "China",
  },
  // ── Rép. Tchèque ────────────────────────────────────────────────────────────
  {
    code: "CZE1",
    name: "Czech Liga",
    nameFr: "Liga Tchèque",
    country: "Czech Republic",
  },
  // ── Serbie ──────────────────────────────────────────────────────────────────
  { code: "SRB1", name: "Super Liga", nameFr: "Super Liga", country: "Serbia" },
  // ── Slovénie ────────────────────────────────────────────────────────────────
  { code: "SVN1", name: "1. SNL", nameFr: "1. SNL", country: "Slovenia" },
  // ── Estonie ─────────────────────────────────────────────────────────────────
  {
    code: "EST1",
    name: "Meistriliiga",
    nameFr: "Meistriliiga",
    country: "Estonia",
  },
  // ── Finlande ────────────────────────────────────────────────────────────────
  {
    code: "FIN1",
    name: "Veikkausliiga",
    nameFr: "Veikkausliiga",
    country: "Finland",
  },
  // ── Islande ─────────────────────────────────────────────────────────────────
  {
    code: "ISL1",
    name: "Úrvalsdeild",
    nameFr: "Úrvalsdeild",
    country: "Iceland",
  },
  // ── Lettonie ────────────────────────────────────────────────────────────────
  { code: "LAT1", name: "Virsliga", nameFr: "Virsliga", country: "Latvia" },
  // ── Europe (coupes) ─────────────────────────────────────────────────────────
  {
    code: "UCL",
    name: "Champions League",
    nameFr: "Ligue des Champions",
    country: "Europe",
  },
  {
    code: "UEL",
    name: "Europa League",
    nameFr: "Ligue Europa",
    country: "Europe",
  },
  {
    code: "UECL",
    name: "Conference League",
    nameFr: "Ligue Europa Conférence",
    country: "Europe",
  },
  // ── International ───────────────────────────────────────────────────────────
  {
    code: "WC26",
    name: "World Cup 2026",
    nameFr: "Coupe du Monde 2026",
    country: "World",
  },
  {
    code: "WCQE",
    name: "WCQ Europe",
    nameFr: "Qualif. CM Europe",
    country: "World",
  },
  {
    code: "UNL",
    name: "Nations League",
    nameFr: "Ligue des Nations",
    country: "World",
  },
  {
    code: "FRI",
    name: "Friendlies",
    nameFr: "Matchs amicaux",
    country: "World",
  },
];
