-- Résumé quotidien des coupons déclarés réglés la veille (décision du
-- 2026-10-28) : une notification par joueur et par jour, le matin, pertes
-- comprises, jamais pendant une pause.
ALTER TYPE "public"."NotificationType" ADD VALUE 'SLIPS_SETTLED_DIGEST';
