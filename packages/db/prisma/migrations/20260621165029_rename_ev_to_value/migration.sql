-- Rename the StrategyChannel enum value EV -> VALUE in place.
-- Prisma's default for an enum value rename is a destructive drop/recreate whose
-- cast ('EV'::text::new_enum) fails on existing rows. RENAME VALUE keeps every
-- row (they become 'VALUE' automatically) and needs no cast. PostgreSQL 10+.
ALTER TYPE "StrategyChannel" RENAME VALUE 'EV' TO 'VALUE';
