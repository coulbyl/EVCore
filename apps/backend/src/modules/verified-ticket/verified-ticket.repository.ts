import { Injectable } from '@nestjs/common';
import type { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

@Injectable()
export class VerifiedTicketRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.VerifiedTicketCreateInput): Promise<void> {
    await this.prisma.client.verifiedTicket.create({
      data,
      select: { id: true },
    });
  }
}
