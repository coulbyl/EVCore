const YOUTH_PATTERN = /\bU\d{2}\b/i;
const CLUB_PATTERN =
  /\b(FC|SC|AC|CF|FK|SK|NK|BK|IF|PSG|Rangers|Lights|Galaxy|Crew|Sounders|Timbers|Dynamo|Dinamo|Lokomotiv|Spartak|Rapid|Wanderers|Benfica|Sporting|Atletico|Athletic)\b/i;
const CLUB_EXACT_NAMES = new Set(['Las Vegas Lights', 'FC Urartu']);

// Mapping: DB team name -> eloratings.net 2/3-letter code.
// Extend as new senior national teams appear in FRI fixtures.
export const TEAM_NAME_TO_ELO_CODE: Record<string, string> = {
  Canada: 'CA',
  Mexico: 'MX',
  Bolivia: 'BO',
  Panama: 'PA',
  Guatemala: 'GT',
  Jamaica: 'JM',
  Grenada: 'GD',
  Martinique: 'MQ',
  Uzbekistan: 'UZ',
  'China PR': 'CN',
  China: 'CN',
  Iran: 'IR',
  Nigeria: 'NG',
  Iceland: 'IS',
  'Trinidad and Tobago': 'TT',
  USA: 'US',
  'United States': 'US',
  Brazil: 'BR',
  Argentina: 'AR',
  France: 'FR',
  Germany: 'DE',
  Spain: 'ES',
  England: 'EN',
  Portugal: 'PT',
  Italy: 'IT',
  Netherlands: 'NL',
  Belgium: 'BE',
  Japan: 'JP',
  'South Korea': 'KO',
  Australia: 'AU',
  Morocco: 'MA',
  Senegal: 'SN',
  Egypt: 'EG',
  'Saudi Arabia': 'SA',
  Colombia: 'CO',
  Chile: 'CL',
  Ecuador: 'EC',
  Uruguay: 'UR',
  Peru: 'PE',
  Venezuela: 'VE',
  Paraguay: 'PY',
  'Costa Rica': 'CR',
  Honduras: 'HN',
  'El Salvador': 'SV',
  Curacao: 'CW',
  Haiti: 'HT',
  Barbados: 'BB',
  'Antigua and Barbuda': 'AG',
  'Saint Kitts and Nevis': 'KN',
  Guadeloupe: 'GP',
  Montserrat: 'MS',
  Ghana: 'GH',
  Finland: 'FI',
  Cyprus: 'CY',
  Moldova: 'MD',
  'Cape Verde Islands': 'CV',
  'United Arab Emirates': 'AE',
  'Faroe Islands': 'FO',
  'New Zealand': 'NZ',
  Armenia: 'AM',
  Belarus: 'BY',
};

function isClubTeam(name: string): boolean {
  return CLUB_EXACT_NAMES.has(name) || CLUB_PATTERN.test(name);
}

export function isSeniorNationalTeam(name: string): boolean {
  return !YOUTH_PATTERN.test(name) && !isClubTeam(name);
}
