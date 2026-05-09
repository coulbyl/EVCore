export type Announcement = {
  id: string;
  title: string;
  description: string;
  href: string | null;
  published: boolean;
  publishedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: string;
    username: string;
    fullName: string;
  } | null;
};

export type CreateAnnouncementInput = {
  title: string;
  description: string;
  href?: string;
  published?: boolean;
  expiresAt?: string;
};

export type UpdateAnnouncementInput = {
  id: string;
  title?: string;
  description?: string;
  href?: string;
  published?: boolean;
  expiresAt?: string;
};
