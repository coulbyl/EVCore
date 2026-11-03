import { Injectable } from '@nestjs/common';
import { Prisma } from '@evcore/db';
import { PrismaService } from '@/prisma.service';
import type { PlayerRow } from './fixture-events.types';

@Injectable()
export class PlayerRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Inserts new players, renames known ones; a photo is never erased by a
   * source that has none. Rows that would not change are not touched.
   */
  async upsertMany(rows: readonly PlayerRow[]): Promise<void> {
    if (rows.length === 0) return;
    const values = Prisma.join(
      rows.map(
        (row) =>
          Prisma.sql`(${row.externalId}, ${row.name}, ${row.photoUrl}, now())`,
      ),
    );
    await this.prisma.client.$executeRaw`
      INSERT INTO public.player ("externalId", name, "photoUrl", "updatedAt")
      VALUES ${values}
      ON CONFLICT ("externalId") DO UPDATE
        SET name = EXCLUDED.name,
            "photoUrl" = COALESCE(EXCLUDED."photoUrl", player."photoUrl"),
            "updatedAt" = now()
        WHERE player.name IS DISTINCT FROM EXCLUDED.name
           OR (EXCLUDED."photoUrl" IS NOT NULL
               AND player."photoUrl" IS DISTINCT FROM EXCLUDED."photoUrl")
    `;
  }
}
