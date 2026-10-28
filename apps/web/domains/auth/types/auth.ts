export type RiskProfile = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export type AuthSessionUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  bio: string | null;
  role: "ADMIN" | "OPERATOR";
  emailVerified: boolean;
  mfaMethod: "EMAIL" | "TOTP" | null;
  totpVerified: boolean;
  avatarUrl: string | null;
  theme: string | null;
  locale: string | null;
  currency: string | null;
  unitMode: string | null;
  unitAmount: string | null;
  unitPercent: string | null;
  riskProfile: RiskProfile;
  emailSupportNotificationsEnabled: boolean;
  hasSeenOnboarding: boolean;
  hasCompletedOnboarding: boolean;
  phoneNumber: string | null;
  phoneNumberConsentGiven: boolean;
  /** Fin de la pause choisie par le joueur (ISO), null hors pause. */
  pausedUntil: string | null;
};

/**
 * Date de fin si la pause est en cours, sinon null. Le serveur bloque déjà
 * ce qui propose un pari ; l'écran l'annonce au lieu d'afficher une erreur.
 */
export function activePauseEnd(
  pausedUntil: string | null,
  now: number = Date.now(),
): string | null {
  return pausedUntil && new Date(pausedUntil).getTime() > now
    ? pausedUntil
    : null;
}

export function isAccountVerified(user: AuthSessionUser): boolean {
  return user.emailVerified || user.totpVerified;
}

export type AuthSession = {
  sessionId: string;
  user: AuthSessionUser;
};
