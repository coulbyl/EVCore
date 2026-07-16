import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  suspended: boolean;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const USER_ROW_SELECT = {
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
} as const;

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
        select: USER_ROW_SELECT,
      }),
    ]);

    return {
      items: users.map((u) => this.toRow(u)),
      total,
      page,
      pageSize,
    };
  }

  async updateUser(
    id: string,
    dto: UpdateUserDto,
    currentUserId: string,
  ): Promise<AdminUserRow> {
    if (dto.suspended && id === currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas suspendre votre propre compte.',
      );
    }

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
        ...(dto.suspended !== undefined && {
          suspended: dto.suspended,
          suspendedAt: dto.suspended ? new Date() : null,
        }),
      },
      select: USER_ROW_SELECT,
    });

    if (dto.suspended) {
      // Kick the user out immediately instead of waiting for their session to expire.
      await this.prisma.client.session.deleteMany({ where: { userId: id } });
    }

    return this.toRow(updated);
  }

  async deleteUser(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }

    const existing = await this.prisma.client.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    await this.prisma.client.user.delete({ where: { id } });
  }

  private toRow(u: {
    id: string;
    email: string;
    username: string;
    fullName: string;
    role: UserRole;
    emailVerified: boolean;
    avatarUrl: string | null;
    locale: string | null;
    currency: string | null;
    suspended: boolean;
    suspendedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): AdminUserRow {
    return {
      ...u,
      suspendedAt: u.suspendedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }
}
