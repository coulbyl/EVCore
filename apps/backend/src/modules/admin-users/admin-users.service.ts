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
import { AdminJournalService } from '@modules/admin-journal/admin-journal.service';
import { SessionCache } from '@modules/auth/session-cache';
import type { ListUsersQueryDto } from './dto/list-users-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';

export type AdminUserRow = {
  id: string;
  email: string;
  username: string | null;
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
    private readonly journal: AdminJournalService,
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

    const before = await this.repository.findState(id);
    if (!before) {
      throw new NotFoundException('User not found');
    }

    try {
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
      // The journal (12-admin.md § 4): a role and a suspension that changed.
      if (dto.role !== undefined && dto.role !== before.role) {
        await this.journal.record({
          actorId: currentUserId,
          kind: 'role',
          target: before.email,
          before: before.role,
          after: dto.role,
        });
      }
      if (dto.suspended !== undefined && dto.suspended !== before.suspended) {
        await this.journal.record({
          actorId: currentUserId,
          kind: 'suspension',
          target: before.email,
          before: before.suspended,
          after: dto.suspended,
        });
      }
      return this.toRow(updated);
    } finally {
      // Rôle, suspension, vérification : la session porte ces champs. Même si
      // la révocation des sessions échoue, la suspension est déjà écrite.
      this.sessionCache.invalidateUser(id);
    }
  }

  async deleteUser(id: string, currentUserId: string): Promise<void> {
    if (id === currentUserId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas supprimer votre propre compte.',
      );
    }

    const before = await this.repository.findState(id);
    if (!before) {
      throw new NotFoundException('User not found');
    }

    await this.repository.delete(id);
    this.sessionCache.invalidateUser(id);
    await this.journal.record({
      actorId: currentUserId,
      kind: 'account_deleted',
      target: before.email,
      before: before.role,
    });
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
