-- Résultat d'un coupon suivi, envoyé le soir même entre 20 h et 1 h (heure
-- d'Abidjan), jamais pendant une pause (2026-10-30, docs/refonte-ui/10 § 3).
ALTER TYPE "public"."NotificationType" ADD VALUE 'FOLLOWED_SETTLED';
