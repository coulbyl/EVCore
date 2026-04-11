export type Competition = {
  code: string;
  name: string;
  country: string;
};

/** Liste des compétitions actives — source de vérité : packages/db/src/seed.ts */
export const COMPETITIONS: Competition[] = [
  // Ligues domestiques — Tier 1
  { code: "PL", name: "Premier League", country: "England" },
  { code: "SA", name: "Serie A", country: "Italy" },
  { code: "LL", name: "La Liga", country: "Spain" },
  { code: "BL1", name: "Bundesliga", country: "Germany" },
  { code: "L1", name: "Ligue 1", country: "France" },
  { code: "ERD", name: "Eredivisie", country: "Netherlands" },
  { code: "POR", name: "Primeira Liga", country: "Portugal" },
  // Ligues domestiques — Tier 2
  { code: "CH", name: "Championship", country: "England" },
  { code: "I2", name: "Serie B", country: "Italy" },
  { code: "SP2", name: "Segunda Division", country: "Spain" },
  { code: "D2", name: "2. Bundesliga", country: "Germany" },
  { code: "F2", name: "Ligue 2", country: "France" },
  { code: "EL1", name: "League One", country: "England" },
  { code: "EL2", name: "League Two", country: "England" },
  // Autres ligues
  { code: "J1", name: "J1 League", country: "Japan" },
  { code: "MX1", name: "Liga MX", country: "Mexico" },
  // Compétitions européennes
  { code: "UCL", name: "Champions League", country: "Europe" },
  { code: "UEL", name: "Europa League", country: "Europe" },
  { code: "UECL", name: "Conference League", country: "Europe" },
  // Internationales
  { code: "WCQE", name: "WCQ Europe", country: "World" },
  { code: "UNL", name: "Nations League", country: "World" },
  { code: "FRI", name: "Friendlies", country: "World" },
];
