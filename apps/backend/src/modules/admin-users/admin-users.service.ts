import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import type { UserRole } from '@evcore/db';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

export type AdminUserRow = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: UserRole;
  emailVerified: boolean;
  avatarUrl: string | null;
  locale: string | null;
  currency: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(query: ListUsersQueryDto): Promise<{
    items: AdminUserRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const q = query.q?.trim() ?? '';
    const role = query.role ?? 'ALL';

    const where = {
      ...(role !== 'ALL' ? { role: role as UserRole } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' as const } },
              { username: { contains: q, mode: 'insensitive' as const } },
              { fullName: { contains: q, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [total, users] = await Promise.all([
      this.prisma.client.user.count({ where }),
      this.prisma.client.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          username: true,
          fullName: true,
          role: true,
          emailVerified: true,
          avatarUrl: true,
          locale: true,
          currency: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      items: users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async updateUser(id: string, dto: UpdateUserDto): Promise<AdminUserRow> {
    const existing = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const updated = await this.prisma.client.user.update({
      where: { id },
      data: {
        role: dto.role,
        emailVerified: dto.emailVerified,
      },
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        role: true,
        emailVerified: true,
        avatarUrl: true,
        locale: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
