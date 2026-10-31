/**
 * L'écran où revenir après connexion (`?next=` posé par le proxy), si et
 * seulement si c'est un chemin de l'application.
 *
 * Refuse tout ce qui sortirait du site : `//evil.com`, `/\evil.com`,
 * `https://…`, `javascript:…`. Sans ce filtre, un lien piégé renverrait le
 * joueur ailleurs juste après qu'il a saisi son mot de passe.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  // Tabulation, retour à la ligne… : un navigateur les retire avant de
  // résoudre l'adresse, ce qui peut transformer « /\t/evil.com » en « //… ».
  for (let index = 0; index < value.length; index += 1) {
    if (value.charCodeAt(index) < 0x20) return null;
  }
  // Un chemin qui, une fois résolu, change d'origine n'est pas interne.
  try {
    const base = "https://evcore.invalid";
    if (new URL(value, base).origin !== base) return null;
  } catch {
    return null;
  }
  return value;
}
