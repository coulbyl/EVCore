import type { Request } from 'express';
import type { UserRole } from '@evcore/db';

export type AuthSessionUser = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  bio: string | null;
  role: UserRole;
  emailVerified: boolean;
  avatarUrl: string | null;
};

export type AuthSession = {
  sessionId: string;
  user: AuthSessionUser;
};

export type AuthenticatedRequest = Request & {
  authSession?: AuthSession;
};
