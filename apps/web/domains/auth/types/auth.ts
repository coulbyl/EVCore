export type AuthSessionUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  bio: string | null;
  role: string;
  emailVerified: boolean;
  avatarUrl: string | null;
};

export type AuthSession = {
  sessionId: string;
  user: AuthSessionUser;
};
