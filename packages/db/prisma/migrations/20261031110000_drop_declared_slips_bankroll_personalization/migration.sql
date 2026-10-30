-- Refonte, 09 § 1 et § 9 (tranché le 29/10) : les coupons déclarés avec
-- mise, le solde (dépôts, retraits, mouvements), la mise par unité, les
-- badges, le classement et la personnalisation (championnats et canaux
-- suivis, profil de risque) sont effacés pour tout le monde à la mise en
-- ligne. Les coupons suivis (coupon_follow) ne sont pas touchés.
--
-- Vérification avant (lecture seule) :
--
--   SELECT 'bet_slip' AS t, count(*) FROM bet_slip
--   UNION ALL SELECT 'bet_slip_item', count(*) FROM bet_slip_item
--   UNION ALL SELECT 'bankroll_transaction', count(*) FROM bankroll_transaction
--   UNION ALL SELECT 'coupon_proposal_placement', count(*) FROM coupon_proposal_placement
--   UNION ALL SELECT 'bet (joueur)', count(*) FROM bet WHERE "userId" IS NOT NULL
--   UNION ALL SELECT 'bet (moteur, gardés)', count(*) FROM bet WHERE "userId" IS NULL
--   UNION ALL SELECT 'user_badge', count(*) FROM user_badge
--   UNION ALL SELECT 'user_followed_channel', count(*) FROM user_followed_channel
--   UNION ALL SELECT 'user_followed_league', count(*) FROM user_followed_league
--   UNION ALL SELECT 'users avec mise par unité', count(*) FROM users WHERE "unitMode" IS NOT NULL
--   UNION ALL SELECT 'coupon_follow (gardés)', count(*) FROM coupon_follow;
--
-- Copie de prod du 29/10 : 12 coupons déclarés, 41 jambes, 86 mouvements,
-- 4 « Jouer ce coupon », 41 paris de joueur (3 438 paris du moteur gardés),
-- 16 badges attribués, 6 canaux et 151 championnats suivis, 4 mises par unité.

DROP TABLE "public"."coupon_proposal_placement";
DROP TABLE "public"."bet_slip_item";
DROP TABLE "public"."bet_slip";
DROP TABLE "public"."bankroll_transaction";
DROP TABLE "public"."user_badge";
DROP TABLE "public"."badge";
DROP TABLE "public"."user_followed_channel";
DROP TABLE "public"."user_followed_league";

-- Les paris créés par les joueurs n'existaient que dans leurs coupons
-- déclarés ; ceux du moteur (userId NULL) restent.
DELETE FROM "public"."bet" WHERE "userId" IS NOT NULL;

ALTER TABLE "public"."users"
  DROP COLUMN "unitMode",
  DROP COLUMN "unitAmount",
  DROP COLUMN "unitPercent",
  DROP COLUMN "riskProfile";

DROP TYPE "public"."BetSlipType";
DROP TYPE "public"."BankrollTransactionType";
DROP TYPE "public"."UnitMode";
DROP TYPE "public"."RiskProfile";
