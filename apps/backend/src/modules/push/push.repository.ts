import { Injectable } from '@nestjs/common';
import { UserRole } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class PushRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsertSubscription(input: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    userAgent?: string;
  }) {
    return this.prisma.client.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: input,
      update: {
        userId: input.userId,
        p256dh: input.p256dh,
        auth: input.auth,
        userAgent: input.userAgent,
      },
    });
  }

  deleteByEndpoint(endpoint: string) {
    return this.prisma.client.pushSubscription.deleteMany({
      where: { endpoint },
    });
  }

  findByUserId(userId: string) {
    return this.prisma.client.pushSubscription.findMany({
      where: { userId },
    });
  }

  findByRole(role: UserRole) {
    return this.prisma.client.pushSubscription.findMany({
      where: { user: { role } },
    });
  }

  // Broadcast audience (announcements) — every subscribed device, optionally
  // excluding the admin who published it.
  findAll(excludeUserId?: string) {
    return this.prisma.client.pushSubscription.findMany({
      where: excludeUserId ? { userId: { not: excludeUserId } } : undefined,
    });
  }
}
