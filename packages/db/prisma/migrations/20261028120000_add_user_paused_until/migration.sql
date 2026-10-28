-- Pause en libre-service (jeu responsable, décision du 2026-10-28) : jusqu'à
-- cette date, tout ce qui propose un pari est bloqué côté serveur et les
-- notifications poussées sont coupées. Nullable : null = pas de pause.
ALTER TABLE "public"."users"
  ADD COLUMN "pausedUntil" TIMESTAMP(3);
