export type AuthSessionUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  bio: string | null;
  role: "ADMIN" | "OPERATOR";
  emailVerified: boolean;
  avatarUrl: string | null;
  theme: string | null;
  locale: string | null;
  currency: string | null;
};

export type AuthSession = {
  sessionId: string;
  user: AuthSessionUser;
};
