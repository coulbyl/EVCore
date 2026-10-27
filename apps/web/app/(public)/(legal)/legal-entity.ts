/**
 * Informations sur l'éditeur, lues par les quatre pages légales.
 *
 * Rien n'est inventé ici : une valeur `null` s'affiche « à compléter » sur
 * le site. Toutes doivent être renseignées par l'éditeur AVANT toute
 * promotion du site (audit du 2026-10-23, P1-1 ; plan marketing §2.1 :
 * déclaration ARTCI préalable à tout fichier client).
 *
 * L'adresse de contact est celle déjà publiée sur la page Aide.
 */
export const LEGAL_ENTITY = {
  /** Raison sociale (ou nom et prénom pour une personne physique). */
  publisher: null as string | null,
  /** Forme juridique et capital, ex. « SARL au capital de … FCFA ». */
  legalForm: null as string | null,
  /** Adresse du siège. */
  address: null as string | null,
  /** Numéro RCCM ou équivalent. */
  registration: null as string | null,
  /** Directeur ou directrice de la publication. */
  publicationDirector: null as string | null,
  /** Hébergeur du site et de la base de données, avec son adresse. */
  host: null as string | null,
  /** Pays où sont hébergées les données. */
  hostingCountry: null as string | null,
  /** Numéro de déclaration ou d'autorisation ARTCI (loi n° 2013-450). */
  dataProtectionFiling: null as string | null,
  /** Droit applicable et tribunaux compétents. */
  jurisdiction: null as string | null,
  contactEmail: "support@evcore.io",
} as const;

/** Date de dernière mise à jour affichée en tête de chaque page légale. */
export const LEGAL_LAST_UPDATED = "27 octobre 2026";

export const TO_COMPLETE = "À compléter par l'éditeur";
