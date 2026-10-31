import { Injectable, NotFoundException } from '@nestjs/common';
import { formatDateUtc } from '@utils/date.utils';
import { ConsoleRepository } from './console.repository';
import type { PlayerAccount, PlayerSheet, PlayersMonth } from './console.types';

const PAGE_SIZE = 30;

/**
 * Joueurs — « viennent-ils ? » (12-admin.md § 3): the month in four
 * figures, the accounts with their follows and pause, one player's sheet.
 * The actions (role, suspension, reset link, deletion) stay on
 * /admin/users, journaled there (G11).
 */
@Injectable()
export class ConsolePlayersService {
  constructor(private readonly repository: ConsoleRepository) {}

  /** `month` is « 2026-11 »; the current month by default. */
  async getMonth(
    month: string | undefined,
    now: Date = new Date(),
  ): Promise<PlayersMonth> {
    const [y, m] = (month ?? now.toISOString().slice(0, 7))
      .split('-')
      .map(Number);
    const year = y ?? now.getUTCFullYear();
    const index = (m ?? now.getUTCMonth() + 1) - 1;
    const start = new Date(Date.UTC(year, index, 1));
    const end = new Date(Date.UTC(year, index + 1, 1));
    const figures = await this.repository.playersMonth({ start, end, now });
    return {
      month: formatDateUtc(start).slice(0, 7),
      signups: figures.signups,
      activated: figures.activated,
      active7: figures.active7,
      morning: { sent: figures.sent, opened: figures.opened },
    };
  }

  async getAccounts(input: { q?: string; page?: number }): Promise<{
    items: PlayerAccount[];
    page: number;
    more: boolean;
  }> {
    const page = Math.max(1, input.page ?? 1);
    const rows = await this.repository.accounts({
      q: input.q ?? '',
      take: PAGE_SIZE + 1,
      skip: (page - 1) * PAGE_SIZE,
    });
    return {
      items: rows.slice(0, PAGE_SIZE).map(accountOf),
      page,
      more: rows.length > PAGE_SIZE,
    };
  }

  async getPlayer(id: string): Promise<PlayerSheet> {
    const { user, followed, conversationId } = await this.repository.player(id);
    if (!user) throw new NotFoundException('Compte inconnu');
    return {
      ...accountOf(user),
      emailVerified: user.emailVerified,
      followed: followed.map((f) => ({
        couponId: f.couponId,
        forDate: formatDateUtc(f.forDate),
        product: f.product,
        outcome: f.outcome,
      })),
      conversationId,
    };
  }
}

function accountOf(row: {
  id: string;
  fullName: string;
  email: string;
  role: string;
  createdAt: Date;
  pausedUntil: Date | null;
  suspended: boolean;
  _count: { couponFollows: number };
}): PlayerAccount {
  return {
    id: row.id,
    name: row.fullName,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    follows: row._count.couponFollows,
    pausedUntil:
      row.pausedUntil && row.pausedUntil > new Date()
        ? row.pausedUntil.toISOString()
        : null,
    suspended: row.suspended,
  };
}
