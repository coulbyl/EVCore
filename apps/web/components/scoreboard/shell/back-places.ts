/**
 * What a way back can say (`BackLink`): « Retour » for a screen without a
 * name, and the screens it names, by path (« /results » → « Retour aux
 * résultats »). Built on the server (`getBackPlaces`), read in the browser.
 */
export type BackPlaces = {
  back: string;
  screens: Readonly<Record<string, string>>;
};

/**
 * The name of a screen: its own, else its closest named parent (a coupon's
 * sheet over Aujourd'hui is « Retour à Aujourd'hui »), else « Retour ».
 * « / » names itself only.
 */
export function placeOf(path: string, places: BackPlaces): string {
  if (path === "/") return places.screens["/"] ?? places.back;
  for (let at = path; at.length > 1; at = parentOf(at)) {
    const named = places.screens[at];
    if (named) return named;
  }
  return places.back;
}

/**
 * The label of a way back: without history (`previous` null), or back to
 * the parent itself, the parent's (`label`, else its place); otherwise the
 * screen before.
 */
export function backLabelOf({
  previous,
  href,
  label,
  places,
}: {
  previous: string | null;
  href: string;
  label?: string;
  places: BackPlaces;
}): string {
  const parent = pathOf(href);
  if (previous === null || previous === parent) {
    return label ?? placeOf(parent, places);
  }
  return placeOf(previous, places);
}

function pathOf(href: string): string {
  return href.split(/[?#]/, 1)[0] || "/";
}

/** « /results/week » → « /results » → « / ». */
function parentOf(path: string): string {
  return path.slice(0, Math.max(1, path.lastIndexOf("/")));
}
