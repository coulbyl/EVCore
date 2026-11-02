import { Injectable } from '@nestjs/common';
import { AdjustmentStatus, type Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';

/** The weight proposals, and the settled bets the shadow correlations read. */
@Injectable()
export class AdjustmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findProposalOrThrow(id: string) {
    return this.prisma.client.adjustmentProposal.findUniqueOrThrow({
      where: { id },
    });
  }

  createProposal(
    data: Prisma.AdjustmentProposalCreateInput,
  ): Promise<{ id: string }> {
    return this.prisma.client.adjustmentProposal.create({
      data,
      select: { id: true },
    });
  }

  listProposals() {
    return this.prisma.client.adjustmentProposal.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  /** An APPLIED proposal since `cutoff`: one auto-apply per week at most. */
  findAppliedSince(cutoff: Date): Promise<{ id: string } | null> {
    return this.prisma.client.adjustmentProposal.findFirst({
      where: { status: AdjustmentStatus.APPLIED, appliedAt: { gte: cutoff } },
      select: { id: true },
    });
  }

  findRecentSettledBetsWithFeatures(take: number) {
    return this.prisma.client.bet.findMany({
      where: { status: { in: ['WON', 'LOST'] } },
      select: { status: true, modelRun: { select: { features: true } } },
      orderBy: { updatedAt: 'desc' },
      take,
    });
  }
}
