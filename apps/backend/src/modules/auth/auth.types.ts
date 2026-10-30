import type { Request } from 'express';
import type { RiskProfile, UserRole } from '@evcore/db';

export type AuthSessionUser = {
  id: string;
  email: string;
  username: string | null;
  fullName: string;
  bio: string | null;
  role: UserRole;
  emailVerified: boolean;
  mfaMethod: 'EMAIL' | 'TOTP' | null;
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
  morningBriefEnabled: boolean;
  weeklyStatementEnabled: boolean;
  hasSeenOnboarding: boolean;
  hasCompletedOnboarding: boolean;
  phoneNumber: string | null;
  phoneNumberConsentGiven: boolean;
  /**
   * Fin de la pause choisie par le joueur (ISO), null hors pause. Pendant la
   * pause, tout ce qui propose un pari est bloqué côté serveur (PausedGuard).
   */
  pausedUntil: string | null;
};

export type AuthSession = {
  sessionId: string;
  user: AuthSessionUser;
};

export type AuthenticatedRequest = Request & {
  authSession?: AuthSession;
};
