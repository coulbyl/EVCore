const BASE = "https://api.dicebear.com/9.x/micah/svg";

export type AvatarOption = {
  url: string;
  label: string;
  requiredBadge?: string;
};

export const FREE_AVATARS: AvatarOption[] = [
  { url: `${BASE}?seed=Striker&backgroundColor=b6e3f4`, label: "Attaquant" },
  { url: `${BASE}?seed=Keeper&backgroundColor=c0aede`, label: "Gardien" },
  { url: `${BASE}?seed=Maestro&backgroundColor=d1d4f9`, label: "Maestro" },
  { url: `${BASE}?seed=Captain&backgroundColor=ffd5dc`, label: "Capitaine" },
  { url: `${BASE}?seed=Rookie&backgroundColor=ffdfbf`, label: "Rookie" },
  { url: `${BASE}?seed=Phantom&backgroundColor=c1f4c5`, label: "Fantôme" },
];

export const LOCKED_AVATARS: AvatarOption[] = [
  {
    url: `${BASE}?seed=Analyst&backgroundColor=b6e3f4`,
    label: "Analyste",
    requiredBadge: "vol_50",
  },
  {
    url: `${BASE}?seed=Strategist&backgroundColor=c0aede`,
    label: "Stratège",
    requiredBadge: "vol_150",
  },
  {
    url: `${BASE}?seed=StrikerX&backgroundColor=ffdfbf`,
    label: "Buteur Élite",
    requiredBadge: "streak_5",
  },
  {
    url: `${BASE}?seed=Oracle&backgroundColor=c1f4c5`,
    label: "Oracle",
    requiredBadge: "calibre",
  },
];

export const AVATAR_OPTIONS: AvatarOption[] = [
  ...FREE_AVATARS,
  ...LOCKED_AVATARS,
];
