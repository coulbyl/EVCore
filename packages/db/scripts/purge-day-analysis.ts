import "dotenv/config";
import { prisma } from "../src/client";

function parseDay(day: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    throw new Error("Expected date in YYYY-MM-DD format");
  }

  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(`${day}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

async function main() {
  const day = process.argv[2];
  if (!day) {
    throw new Error("Usage: tsx scripts/purge-day-analysis.ts YYYY-MM-DD");
  }

  const { start, end } = parseDay(day);

  const fixtureIds = (
    await prisma.fixture.findMany({
      where: {
        scheduledAt: {
          gte: start,
          lt: end,
        },
      },
      select: { id: true },
    })
  ).map((fixture) => fixture.id);

  const betIds = (
    await prisma.bet.findMany({
      where: { fixtureId: { in: fixtureIds } },
      select: { id: true },
    })
  ).map((bet) => bet.id);

  const couponIds = (
    await prisma.dailyCoupon.findMany({
      where: { date: start },
      select: { id: true },
    })
  ).map((coupon) => coupon.id);

  const modelRunCount = await prisma.modelRun.count({
    where: { fixtureId: { in: fixtureIds } },
  });
  const betCount = betIds.length;
  const couponLegCount = await prisma.couponLeg.count({
    where: {
      OR: [
        { betId: { in: betIds } },
        { couponId: { in: couponIds } },
      ],
    },
  });
  const couponCount = couponIds.length;

  const result = await prisma.$transaction(async (tx) => {
    const deletedCouponLegs = await tx.couponLeg.deleteMany({
      where: {
        OR: [
          { betId: { in: betIds } },
          { couponId: { in: couponIds } },
        ],
      },
    });

    const deletedBets = await tx.bet.deleteMany({
      where: { fixtureId: { in: fixtureIds } },
    });

    const deletedModelRuns = await tx.modelRun.deleteMany({
      where: { fixtureId: { in: fixtureIds } },
    });

    const deletedCoupons = await tx.dailyCoupon.deleteMany({
      where: { date: start },
    });

    return {
      deletedCouponLegs: deletedCouponLegs.count,
      deletedBets: deletedBets.count,
      deletedModelRuns: deletedModelRuns.count,
      deletedCoupons: deletedCoupons.count,
    };
  });

  console.log(
    JSON.stringify(
      {
        day,
        fixtureCount: fixtureIds.length,
        modelRunCount,
        betCount,
        couponLegCount,
        couponCount,
        ...result,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
