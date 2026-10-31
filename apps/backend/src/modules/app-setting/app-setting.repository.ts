import { Injectable } from '@nestjs/common';
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
}
