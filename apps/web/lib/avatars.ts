import { AVATAR_CHOICES } from "@evcore/analysis-core";

export type AvatarOption = {
  url: string;
  label: string;
  requiredBadge?: string;
};

// Fichiers servis par l'application (public/avatars) ; même liste que la
// validation du backend (analysis-core/display/avatars.ts).
const OPTIONS: AvatarOption[] = AVATAR_CHOICES.map((choice) => ({
  url: choice.path,
  label: choice.label,
  ...(choice.requiredBadge ? { requiredBadge: choice.requiredBadge } : {}),
}));

export const FREE_AVATARS: AvatarOption[] = OPTIONS.filter(
  (option) => !option.requiredBadge,
);

export const LOCKED_AVATARS: AvatarOption[] = OPTIONS.filter(
  (option) => option.requiredBadge,
);

export const AVATAR_OPTIONS: AvatarOption[] = OPTIONS;
