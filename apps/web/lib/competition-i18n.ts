// Single source of truth for competition/country French labels — every
// active `Competition` row (checked against the DB, 68 rows) must have an
// entry here. Two different call sites used to keep their own partial copy
// (this file's maps + a `nameFr` field duplicated in
// apps/web/constants/competitions.ts) — that let names drift out of sync
// and left leagues added since untranslated. Keyed by the exact `name`/
// `country` string API-Football/the DB uses, not by competition code: most
// entries below are proper nouns that stay identical in French, so a name
// shared by two countries (e.g. "Premier League" for England and Russia,
// "Bundesliga" for Germany and Austria) still resolves to the same correct
// translation without needing the code to disambiguate.
const COUNTRY_FR: Record<string, string> = {
  Argentina: "Argentine",
  Australia: "Australie",
  Austria: "Autriche",
  Belgium: "Belgique",
  Brazil: "Brésil",
  Chile: "Chili",
  China: "Chine",
  "Czech Republic": "République tchèque",
  Denmark: "Danemark",
  England: "Angleterre",
  Estonia: "Estonie",
  Europe: "Europe",
  Finland: "Finlande",
  France: "France",
  Germany: "Allemagne",
  Greece: "Grèce",
  Iceland: "Islande",
  Ireland: "Irlande",
  Italy: "Italie",
  Japan: "Japon",
  Latvia: "Lettonie",
  Mexico: "Mexique",
  Netherlands: "Pays-Bas",
  Norway: "Norvège",
  Poland: "Pologne",
  Portugal: "Portugal",
  Russia: "Russie",
  "Saudi-Arabia": "Arabie saoudite",
  Scotland: "Écosse",
  Serbia: "Serbie",
  Slovenia: "Slovénie",
  "South-Korea": "Corée du Sud",
  Spain: "Espagne",
  Sweden: "Suède",
  Switzerland: "Suisse",
  Turkey: "Turquie",
  USA: "États-Unis",
  World: "Monde",
};

const COMPETITION_FR: Record<string, string> = {
  // Argentina
  "Liga Profesional Argentina": "Liga Profesional Argentina",
  "Primera Nacional": "Primera Nacional",
  // Australia
  "A-League": "A-League",
  // Austria / Germany (same name, both resolve identically)
  Bundesliga: "Bundesliga",
  "2. Bundesliga": "2. Bundesliga",
  "3. Liga": "3. Liga",
  // Belgium
  "Jupiler Pro League": "Jupiler Pro League",
  // Brazil
  "Brasileirão Série A": "Brasileirão",
  "Série B": "Série B",
  // Chile
  "Primera División": "Primera División",
  "Segunda División": "Segunda División",
  // China / England (League One/Super League shared names, same translation)
  "League One": "League One",
  "Super League": "Super League",
  // Czech Republic
  "Czech Liga": "Liga Tchèque",
  // Denmark
  Superliga: "Superliga",
  // England
  Championship: "Championship",
  "League Two": "League Two",
  "Premier League": "Premier League",
  // Estonia
  Meistriliiga: "Meistriliiga",
  // Europe
  "Champions League": "Ligue des champions",
  // Rebrand 2023-06-28 (UEFA ExCo) : "Ligue Europa Conférence" → "Ligue
  // Conférence" à partir de la saison 2024-25, "Europa" abandonné.
  "UEFA Europa Conference League": "Ligue Conférence",
  "UEFA Europa League": "Ligue Europa",
  // Finland
  Veikkausliiga: "Veikkausliiga",
  Ykkösliiga: "Ykkösliiga",
  // France
  "Ligue 1": "Ligue 1",
  "Ligue 2": "Ligue 2",
  // Greece
  "Super League 1": "Super League 1",
  // Iceland
  Úrvalsdeild: "Úrvalsdeild",
  // Ireland
  "Premier Division": "Premier Division",
  // Italy
  "Serie A": "Série A",
  "Serie B": "Série B",
  // Japan
  "J1 League": "J1 League",
  // Latvia
  Virsliga: "Virsliga",
  // Mexico
  "Liga MX": "Liga MX",
  // Netherlands
  Eredivisie: "Eredivisie",
  // Norway
  "1. Division": "1. Division",
  Eliteserien: "Eliteserien",
  // Poland
  Ekstraklasa: "Ekstraklasa",
  "I Liga": "I Liga",
  // Portugal
  "Primeira Liga": "Liga Portugal",
  // Saudi Arabia
  "Pro League": "Pro League",
  // Scotland
  Premiership: "Premiership",
  // Serbia
  "Super Liga": "Super Liga",
  // Slovenia
  "1. SNL": "1. SNL",
  // South Korea
  "K League 1": "K League 1",
  "K League 2": "K League 2",
  // Spain
  "La Liga": "La Liga",
  "Segunda Division": "Segunda División",
  // Sweden
  Allsvenskan: "Allsvenskan",
  Superettan: "Superettan",
  // Switzerland
  "Challenge League": "Challenge League",
  // Turkey
  "Süper Lig": "Süper Lig",
  "1. Lig": "1. Lig",
  // USA
  "Major League Soccer": "MLS",
  "USL Championship": "USL Championship",
  // World
  "FIFA World Cup": "Coupe du monde 2026",
  "International Friendlies": "Matchs amicaux",
  "UEFA Nations League": "Ligue des nations",
  "World Cup Qualification - Africa": "Qualif. CM Afrique",
  "World Cup Qualification - Asia": "Qualif. CM Asie",
  "World Cup Qualification - CONCACAF": "Qualif. CM CONCACAF",
  "World Cup Qualification - Europe": "Qualif. CM Europe",
  "World Cup Qualification - Oceania": "Qualif. CM Océanie",
  "World Cup Qualification - South America": "Qualif. CM Amérique du Sud",
};

export function translateCountry(country: string, locale: string): string {
  if (locale !== "fr") return country;
  return COUNTRY_FR[country] ?? country;
}

export function translateCompetition(
  competition: string,
  locale: string,
): string {
  if (locale !== "fr") return competition;
  return COMPETITION_FR[competition] ?? competition;
}
