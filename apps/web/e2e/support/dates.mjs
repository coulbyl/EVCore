/** Ce lundi (ou le dernier), à l'heure locale donnée : le relevé du lundi. */
export function lastMondayAt(hour) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
