export type Announcement = {
  id: string;
  title: string;
  description: string | null;
  href: string;
  published: boolean;
  publishedAt: string | null;
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
  description?: string;
  href: string;
  published?: boolean;
};

export type UpdateAnnouncementInput = {
  id: string;
  title?: string;
  description?: string;
  href?: string;
  published?: boolean;
};
