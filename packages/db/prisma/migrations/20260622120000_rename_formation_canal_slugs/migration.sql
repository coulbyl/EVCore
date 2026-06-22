-- Align persisted formation article slugs with the canonical channel vocabulary,
-- in English ("canal" -> "channel"). The article content/files and
-- FORMATION_GRADUATE_ARTICLES were renamed in the same change; this preserves
-- users' completion progress by migrating the stored slugs in
-- user_content_progress.
--
--   canal-ev        -> value-channel
--   canal-sv        -> safe-channel
--   canal-confiance -> dominant-channel
--   canal-draw      -> draw-channel
--   canal-btts      -> btts-channel
--   les-3-canaux    -> the-3-channels
--
-- The unique key is (userId, contentType, slug); the new slugs do not yet exist,
-- so a straight UPDATE cannot collide.

UPDATE "user_content_progress" SET "slug" = 'value-channel'    WHERE "slug" = 'canal-ev';
UPDATE "user_content_progress" SET "slug" = 'safe-channel'     WHERE "slug" = 'canal-sv';
UPDATE "user_content_progress" SET "slug" = 'dominant-channel' WHERE "slug" = 'canal-confiance';
UPDATE "user_content_progress" SET "slug" = 'draw-channel'     WHERE "slug" = 'canal-draw';
UPDATE "user_content_progress" SET "slug" = 'btts-channel'     WHERE "slug" = 'canal-btts';
UPDATE "user_content_progress" SET "slug" = 'the-3-channels'   WHERE "slug" = 'les-3-canaux';
