export type AdminUserRole = "ADMIN" | "OPERATOR";

export type AdminUserRow = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: AdminUserRole;
  emailVerified: boolean;
  avatarUrl: string | null;
  locale: string | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminUsersListResponse = {
  items: AdminUserRow[];
  total: number;
  page: number;
  pageSize: number;
};
