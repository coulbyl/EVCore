import { cache } from "react";
import { getCurrentSession } from "./get-current-session";

/**
 * La session, lue une seule fois par requête pour tout l'arbre du joueur :
 * la mise en page et le bandeau de chaque écran l'appellent, React la
 * mémorise pour la durée du rendu (budget : une lecture de session par
 * requête, docs/refonte-ui/16-performance-et-qualite.md § 2).
 */
export const getPlayerSession = cache(getCurrentSession);
