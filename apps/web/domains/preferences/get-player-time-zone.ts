import { cookies } from "next/headers";
import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
} from "@/helpers/scoreboard-format";

/** Le cookie où l'appareil dépose son fuseau (TimeZoneSync). */
export const TIME_ZONE_COOKIE = "tz";

/**
 * Le fuseau dans lequel écrire les heures côté serveur : celui de
 * l'appareil, déposé par le navigateur, sinon Abidjan (10-transverse.md § 6 :
 * « les heures de l'appareil »). Un serveur en UTC écrirait sinon 19:00 pour
 * un match à 20:00 à Douala.
 */
export async function getPlayerTimeZone(): Promise<string> {
  const value = (await cookies()).get(TIME_ZONE_COOKIE)?.value;
  return value && isValidTimeZone(value) ? value : DEFAULT_TIME_ZONE;
}
