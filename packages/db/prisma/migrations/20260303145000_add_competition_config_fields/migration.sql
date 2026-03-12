-- Move ETL competition runtime config into DB competition table.
-- Adds league mapping + activation flags used by schedulers/workers.

ALTER TABLE "competition"
  ADD COLUMN "leagueId" INTEGER,
  ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "csvDivisionCode" TEXT,
  ADD COLUMN "seasonStartMonth" INTEGER,
  ADD COLUMN "activeSeasonsCount" INTEGER;

UPDATE "competition"
SET
  "leagueId" = CASE "code"
    WHEN 'PL' THEN 39
    WHEN 'SA' THEN 135
    WHEN 'LL' THEN 140
    WHEN 'BL1' THEN 78
    WHEN 'L1' THEN 61
    WHEN 'CH' THEN 40
    WHEN 'I2' THEN 136
    WHEN 'SP2' THEN 141
    WHEN 'D2' THEN 79
    WHEN 'F2' THEN 62
    ELSE NULL
  END,
  "isActive" = CASE "code"
    WHEN 'PL' THEN true
    WHEN 'SA' THEN true
    WHEN 'LL' THEN true
    WHEN 'BL1' THEN true
    WHEN 'L1' THEN true
    ELSE false
  END,
  "csvDivisionCode" = CASE "code"
    WHEN 'PL' THEN 'E0'
    WHEN 'SA' THEN 'I1'
    WHEN 'LL' THEN 'SP1'
    WHEN 'BL1' THEN 'D1'
    WHEN 'L1' THEN 'F1'
    WHEN 'CH' THEN 'E1'
    WHEN 'I2' THEN 'I2'
    WHEN 'SP2' THEN 'SP2'
    WHEN 'D2' THEN 'D2'
    WHEN 'F2' THEN 'F2'
    ELSE NULL
  END;

ALTER TABLE "competition"
  ALTER COLUMN "leagueId" SET NOT NULL;

CREATE UNIQUE INDEX "competition_leagueId_key" ON "competition"("leagueId");
