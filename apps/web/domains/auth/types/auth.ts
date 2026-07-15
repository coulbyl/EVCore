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
  emailSupportNotificationsEnabled: boolean;
};

export function isAccountVerified(user: AuthSessionUser): boolean {
  return user.emailVerified || user.totpVerified;
}

export type AuthSession = {
  sessionId: string;
  user: AuthSessionUser;
};
