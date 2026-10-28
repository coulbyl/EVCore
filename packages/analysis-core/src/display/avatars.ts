/**
 * Les avatars proposés au joueur, servis par l'application
 * (apps/web/public/avatars) depuis le 2026-10-28 : avant, chaque affichage
 * appelait api.dicebear.com, un tiers qui voyait passer nos joueurs. Liste
 * partagée par l'écran et par la validation du backend, qui refuse tout
 * autre chemin et un avatar à badge sans le badge.
 *
 * Style « Micah » de DiceBear, remix de « Avatar Illustration System » par
 * Micah Lanier, sous licence CC BY 4.0 (crédit dans les mentions légales).
 */
export type AvatarChoice = {
  path: string;
  label: string;
  /** Badge nécessaire pour le choisir ; absent = libre. */
  requiredBadge?: string;
};

const avatar = (file: string, label: string, requiredBadge?: string) => ({
  path: `/avatars/${file}.svg`,
  label,
  ...(requiredBadge ? { requiredBadge } : {}),
});

export const AVATAR_CHOICES: readonly AvatarChoice[] = [
  avatar("striker", "Attaquant"),
  avatar("keeper", "Gardien"),
  avatar("maestro", "Maestro"),
  avatar("captain", "Capitaine"),
  avatar("rookie", "Rookie"),
  avatar("phantom", "Fantôme"),
  avatar("analyst", "Analyste"),
  avatar("strategist", "Stratège"),
  avatar("strikerx", "Buteur Élite"),
  // Débloqué en lisant les cinq fiches de la Formation (badge « Diplômé »).
  avatar("oracle", "Oracle", "graduate"),
];

export const AVATAR_PATHS: readonly string[] = AVATAR_CHOICES.map(
  (choice) => choice.path,
);

export function avatarChoiceFor(path: string): AvatarChoice | undefined {
  return AVATAR_CHOICES.find((choice) => choice.path === path);
}
