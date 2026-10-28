-- Avatars servis par l'application (2026-10-28) : les URL api.dicebear.com
-- deviennent les fichiers de apps/web/public/avatars, même dessin (même
-- graine). Une graine inconnue retombe sur les initiales (NULL).
UPDATE "public"."users"
SET "avatarUrl" = CASE substring("avatarUrl" from 'seed=([A-Za-z]+)')
    WHEN 'Striker' THEN '/avatars/striker.svg'
    WHEN 'Keeper' THEN '/avatars/keeper.svg'
    WHEN 'Maestro' THEN '/avatars/maestro.svg'
    WHEN 'Captain' THEN '/avatars/captain.svg'
    WHEN 'Rookie' THEN '/avatars/rookie.svg'
    WHEN 'Phantom' THEN '/avatars/phantom.svg'
    WHEN 'Analyst' THEN '/avatars/analyst.svg'
    WHEN 'Strategist' THEN '/avatars/strategist.svg'
    WHEN 'StrikerX' THEN '/avatars/strikerx.svg'
    WHEN 'Oracle' THEN '/avatars/oracle.svg'
    ELSE NULL
  END
WHERE "avatarUrl" LIKE 'https://api.dicebear.com/%';
