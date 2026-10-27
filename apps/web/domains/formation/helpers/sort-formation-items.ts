import type { FormationContentMeta } from "../types/formation";

/** Fiches dans l'ordre de lecture (`order` du front matter). Module neutre :
 * appelé par la liste (client) et par la page d'une fiche (serveur). */
export function sortFormationItems(
  items: readonly FormationContentMeta[],
): FormationContentMeta[] {
  return items
    .slice()
    .sort(
      (a, b) =>
        (a.order ?? Number.POSITIVE_INFINITY) -
          (b.order ?? Number.POSITIVE_INFINITY) ||
        a.title.localeCompare(b.title),
    );
}
