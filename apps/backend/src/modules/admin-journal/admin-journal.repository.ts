import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type { AdminActionEntry, AdminActionView } from './admin-journal.types';

const json = (value: unknown) =>
  value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

@Injectable()
export class AdminJournalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(entry: AdminActionEntry): Promise<void> {
    const actor = await this.prisma.client.user.findUnique({
      where: { id: entry.actorId },
      select: { fullName: true, email: true },
    });
    await this.prisma.client.adminAction.create({
      data: {
        actorId: entry.actorId,
        actorName: actor?.fullName || actor?.email || '—',
        kind: entry.kind,
        target: entry.target,
        before: json(entry.before),
        after: json(entry.after),
        reason: entry.reason ?? null,
      },
    });
  }

  async list(input: {
    actorId?: string;
    take: number;
  }): Promise<AdminActionView[]> {
    const rows = await this.prisma.client.adminAction.findMany({
      where: input.actorId ? { actorId: input.actorId } : {},
      orderBy: { createdAt: 'desc' },
      take: input.take,
    });
    return rows.map((row) => ({
      id: row.id,
      at: row.createdAt.toISOString(),
      actorId: row.actorId,
      actor: row.actorName,
      kind: row.kind,
      target: row.target,
      before: row.before,
      after: row.after,
      reason: row.reason,
    }));
  }

  /** Rewrites every line about `target` to `replacement`. */
  async renameTarget(input: {
    target: string;
    replacement: string;
  }): Promise<void> {
    await this.prisma.client.adminAction.updateMany({
      where: { target: input.target },
      data: { target: input.replacement },
    });
  }

  /** The people who acted, for the journal's filter. */
  async actors(): Promise<{ id: string; name: string }[]> {
    const rows = await this.prisma.client.adminAction.findMany({
      where: { actorId: { not: null } },
      distinct: ['actorId'],
      orderBy: { actorId: 'asc' },
      select: { actorId: true, actorName: true },
    });
    return rows.flatMap((row) =>
      row.actorId ? [{ id: row.actorId, name: row.actorName }] : [],
    );
  }
}
