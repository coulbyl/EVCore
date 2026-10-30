import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { UserRole } from '@evcore/db';
import {
  AdminUsersRepository,
  type AdminUserRecord,
} from './admin-users.repository';
import { SessionCache } from '@modules/auth/session-cache';
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

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly repository: AdminUsersRepository,
    private readonly sessionCache: SessionCache,
  ) {}

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

    const { total, users } = await this.repository.listPage({
      filter: { q, role },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

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

    if (!(await this.repository.exists(id))) {
      throw new NotFoundException('User not found');
    }

    const updated = await this.repository.update(id, {
      role: dto.role,
      emailVerified: dto.emailVerified,
      ...(dto.suspended !== undefined && {
        suspended: dto.suspended,
        suspendedAt: dto.suspended ? new Date() : null,
      }),
    });

    if (dto.suspended) {
      // Kick the user out immediately instead of waiting for their session to expire.
      await this.repository.deleteSessions(id);
    }
    // Rôle, suspension, vérification : la session porte ces champs.
    this.sessionCache.invalidateUser(id);

    return this.toRow(updated);
  }

  async deleteUser(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }

    if (!(await this.repository.exists(id))) {
      throw new NotFoundException('User not found');
    }

    await this.repository.delete(id);
    this.sessionCache.invalidateUser(id);
  }

  private toRow(u: AdminUserRecord): AdminUserRow {
    return {
      ...u,
      suspendedAt: u.suspendedAt?.toISOString() ?? null,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    };
  }
}
