/**
 * Semaine ISO-8601 d'une journée, au format `AAAA-SS`.
 *
 * L'année ISO est celle du JEUDI de la semaine, pas celle du jour : le
 * 2026-01-01 appartient à la semaine 2026-01, mais le 2021-01-01 appartient à
 * la semaine 2020-53. Le 4 janvier tombe toujours dans la semaine 1 et sert
 * donc d'ancre.
 *
 * Extraite d'un script de backtest le 2026-09-16 après qu'une revue ait
 * trouvé un décalage d'une semaine sur toutes les dates. Le regroupement
 * restait bon — lundi et dimanche tombaient bien ensemble — seul le numéro
 * était faux, ce qui ne se voyait pas tant qu'il servait de simple clé. Une
 * fonction que personne ne peut tester est une fonction que personne ne
 * vérifie : d'où son déplacement hors des scripts.
 */
export function isoWeek(day: string): string {
  const date = new Date(`${day}T00:00:00Z`);
  const thursday = new Date(date);
  thursday.setUTCDate(date.getUTCDate() + 3 - ((date.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  firstThursday.setUTCDate(
    firstThursday.getUTCDate() + 3 - ((firstThursday.getUTCDay() + 6) % 7),
  );
  const week =
    1 +
    Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${thursday.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}
