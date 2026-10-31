import { Injectable } from '@nestjs/common';
import type { Prisma, UserRole } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

export const ADMIN_USER_ROW_SELECT = {
  id: true,
  email: true,
  username: true,
  fullName: true,
  role: true,
  emailVerified: true,
  avatarUrl: true,
  locale: true,
  currency: true,
  suspended: true,
  suspendedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type AdminUserRecord = Prisma.UserGetPayload<{
  select: typeof ADMIN_USER_ROW_SELECT;
}>;

export type AdminUserFilter = {
  /** Matched against email, username and full name, case-insensitive. */
  q: string;
  role: UserRole | 'ALL';
};

@Injectable()
export class AdminUsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listPage(input: {
    filter: AdminUserFilter;
    skip: number;
    take: number;
  }): Promise<{ total: number; users: AdminUserRecord[] }> {
    const where = whereOf(input.filter);
    const [total, users] = await Promise.all([
      this.prisma.client.user.count({ where }),
      this.prisma.client.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.skip,
        take: input.take,
        select: ADMIN_USER_ROW_SELECT,
      }),
    ]);
    return { total, users };
  }

  async exists(userId: string): Promise<boolean> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    return user !== null;
  }

  update(
    userId: string,
    data: Prisma.UserUpdateInput,
  ): Promise<AdminUserRecord> {
    return this.prisma.client.user.update({
      where: { id: userId },
      data,
      select: ADMIN_USER_ROW_SELECT,
    });
  }

  async deleteSessions(userId: string): Promise<void> {
    await this.prisma.client.session.deleteMany({ where: { userId } });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.client.user.delete({ where: { id: userId } });
  }
}

function whereOf(filter: AdminUserFilter): Prisma.UserWhereInput {
  return {
    ...(filter.role !== 'ALL' ? { role: filter.role } : {}),
    ...(filter.q
      ? {
          OR: [
            { email: { contains: filter.q, mode: 'insensitive' as const } },
            { username: { contains: filter.q, mode: 'insensitive' as const } },
            { fullName: { contains: filter.q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}
