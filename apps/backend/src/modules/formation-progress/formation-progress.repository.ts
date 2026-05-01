import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma.service';
import { FormationContentType } from '@evcore/db';

@Injectable()
export class FormationProgressRepository {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.client.userContentProgress.findMany({
      where: { userId },
      select: { contentType: true, slug: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
    });
  }

  upsert(input: {
    userId: string;
    contentType: FormationContentType;
    slug: string;
  }) {
    const { userId, contentType, slug } = input;
    return this.prisma.client.userContentProgress.upsert({
      where: {
        userId_contentType_slug: { userId, contentType, slug },
      },
      create: { userId, contentType, slug, completedAt: new Date() },
      update: { completedAt: new Date() },
      select: { contentType: true, slug: true, completedAt: true },
    });
  }

  remove(input: {
    userId: string;
    contentType: FormationContentType;
    slug: string;
  }) {
    const { userId, contentType, slug } = input;
    return this.prisma.client.userContentProgress.delete({
      where: {
        userId_contentType_slug: { userId, contentType, slug },
      },
    });
  }
}
