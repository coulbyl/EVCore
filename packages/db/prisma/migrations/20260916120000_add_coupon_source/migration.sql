-- Distingue les deux générateurs de coupon qui tournent désormais en parallèle.
--
-- Sans cette colonne, les propositions du LLM et celles du compositeur par le
-- prix se mélangent dans la même table et deviennent indémêlables au bout de
-- quelques jours. `source` entre aussi dans la clé unique : les deux peuvent
-- proposer le même jour sur la même cible de cote sans que l'upsert de l'un
-- écrase la proposition de l'autre.
CREATE TYPE "public"."coupon_source" AS ENUM ('LLM', 'PRICE_COMPOSER');

-- Toutes les lignes existantes viennent du LLM : aucune autre source n'a jamais
-- écrit dans cette table.
ALTER TABLE "public"."coupon_proposal"
  ADD COLUMN "source" "public"."coupon_source" NOT NULL DEFAULT 'LLM';

-- Le nom généré par défaut dépasserait les 63 caractères de Postgres ; il est
-- donc fixé explicitement ici ET dans le schéma (`map:`), faute de quoi la
-- troncature silencieuse fait voir une dérive à `prisma migrate`.
DROP INDEX IF EXISTS "public"."coupon_proposal_forDate_signalWindowDays_targ_key";
DROP INDEX IF EXISTS "public"."coupon_proposal_forDate_signalWindowDays_targetOddsMin_targ_key";

CREATE UNIQUE INDEX "coupon_proposal_source_target_rank_key"
  ON "public"."coupon_proposal"
  ("forDate", "source", "signalWindowDays", "targetOddsMin", "targetOddsMax", "rank");
