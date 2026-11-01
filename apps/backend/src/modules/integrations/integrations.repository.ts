import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';

export type IntegrationRow = {
  key: string;
  value: string;
  secret: boolean;
  updatedAt: Date;
  updatedBy: string | null;
};

/** Every query on `integration_setting` (CLAUDE.md: Prisma here only). */
@Injectable()
export class IntegrationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async rows(): Promise<IntegrationRow[]> {
    const rows = await this.prisma.client.integrationSetting.findMany({
      select: {
        key: true,
        value: true,
        secret: true,
        updatedAt: true,
        updatedBy: { select: { fullName: true } },
      },
    });
    return rows.map((row) => ({
      key: row.key,
      value: row.value,
      secret: row.secret,
      updatedAt: row.updatedAt,
      updatedBy: row.updatedBy?.fullName ?? null,
    }));
  }

  async write(input: {
    key: string;
    value: string;
    secret: boolean;
    actorId: string;
  }): Promise<void> {
    const data = {
      value: input.value,
      secret: input.secret,
      updatedById: input.actorId,
    };
    await this.prisma.client.integrationSetting.upsert({
      where: { key: input.key },
      create: { key: input.key, ...data },
      update: data,
    });
  }

  async remove(key: string): Promise<void> {
    await this.prisma.client.integrationSetting.deleteMany({ where: { key } });
  }
}
