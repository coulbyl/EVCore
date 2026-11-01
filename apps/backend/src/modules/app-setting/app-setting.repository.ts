import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type { AppSettingKey } from '@evcore/analysis-core';

@Injectable()
export class AppSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** The stored JSON of a key, or undefined when no row is written. */
  async findValue(key: AppSettingKey): Promise<unknown> {
    const row = await this.prisma.client.appSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    return row?.value;
  }

  /** Every written row, with who wrote it. */
  rows(): Promise<
    { key: string; value: unknown; updatedAt: Date; updatedBy: string | null }[]
  > {
    return this.prisma.client.appSetting
      .findMany({
        select: {
          key: true,
          value: true,
          updatedAt: true,
          updatedBy: { select: { fullName: true } },
        },
      })
      .then((rows) =>
        rows.map((row) => ({
          key: row.key,
          value: row.value,
          updatedAt: row.updatedAt,
          updatedBy: row.updatedBy?.fullName ?? null,
        })),
      );
  }

  async write(input: {
    key: AppSettingKey;
    value: Prisma.InputJsonValue;
    actorId: string;
  }): Promise<void> {
    await this.prisma.client.appSetting.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        value: input.value,
        updatedById: input.actorId,
      },
      update: { value: input.value, updatedById: input.actorId },
    });
  }
}
