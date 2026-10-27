/** Une seule catégorie depuis le 2026-10-27 (cinq fiches) ; le type reste
 * pour la progression enregistrée côté navigateur, qui la stocke. */
export type FormationCategory = "bases";

/** « video » reste connu de l'API de progression (enum backend), mais aucune
 * vidéo n'est publiée : la seule prévue n'a jamais été tournée. */
export type FormationContentType = "article" | "video";

export type FormationContentMeta = {
  type: FormationContentType;
  slug: string;
  title: string;
  category: FormationCategory;
  order?: number;
  readTime: number;
  summary?: string;
  updatedAt?: string;
};

export type FormationContentItem = FormationContentMeta & {
  content: string;
};
