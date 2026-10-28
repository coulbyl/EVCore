import { Injectable } from '@nestjs/common';
import { type Prisma, ProductEventType } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class ActivityRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Un jour actif ; sans effet si le joueur l'a déjà. */
  async recordActiveDay(userId: string, day: Date): Promise<void> {
    await this.prisma.client.userActivityDay.createMany({
      data: [{ userId, day }],
      skipDuplicates: true,
    });
  }

  async recordEvent(input: {
    userId: string;
    type: ProductEventType;
    payload?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.client.productEvent.create({ data: input });
  }
}
