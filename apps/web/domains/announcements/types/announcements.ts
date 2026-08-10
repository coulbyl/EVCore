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

// GET /dashboard/announcements — per-user read state (AnnouncementRead),
// distinct from the admin-only Announcement shape above.
export type UserAnnouncement = Announcement & { isRead: boolean };

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
