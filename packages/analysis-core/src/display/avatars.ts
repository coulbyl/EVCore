/**
 * Les avatars proposés au joueur, servis par l'application
 * (apps/web/public/avatars) depuis le 2026-10-28 : avant, chaque affichage
 * appelait api.dicebear.com, un tiers qui voyait passer nos joueurs. Liste
 * partagée par l'écran et par la validation du backend, qui refuse tout
 * autre chemin. Tous libres depuis le 2026-10-31 : plus de badge à mériter.
 *
 * Style « Micah » de DiceBear, remix de « Avatar Illustration System » par
 * Micah Lanier, sous licence CC BY 4.0 (crédit dans les mentions légales).
 */
export type AvatarChoice = {
  path: string;
  label: string;
};

const avatar = (file: string, label: string): AvatarChoice => ({
  path: `/avatars/${file}.svg`,
  label,
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
  avatar("oracle", "Oracle"),
];

export const AVATAR_PATHS: readonly string[] = AVATAR_CHOICES.map(
  (choice) => choice.path,
);

export function avatarChoiceFor(path: string): AvatarChoice | undefined {
  return AVATAR_CHOICES.find((choice) => choice.path === path);
}
