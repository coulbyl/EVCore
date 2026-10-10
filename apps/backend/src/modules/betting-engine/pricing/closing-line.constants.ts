/**
 * Fraîcheur exigée d'une ligne de clôture pour qu'elle serve au CLV d'un
 * pari (chantier E, E-2), jambe de coupon ou sélection de canal.
 *
 * Le balayage de clôture relève à T−60 et T−10 min (chantier B) : 90 min
 * absorbe un retard de file sur le relevé T−60 et rejette les relevés de la
 * veille (7 h et plus), qui ne sont pas des clôtures — comparer un prix pris
 * à J−1 avec un « dernier relevé » lui aussi de J−1 ne mesure que du
 * décalage temporel. Même seuil que la colonne « Relevé < 90 min » de
 * `report:freshness`.
 */
export const CLOSING_LINE_POLICY = {
  maxHoursBeforeKickoff: 1.5,
} as const;
