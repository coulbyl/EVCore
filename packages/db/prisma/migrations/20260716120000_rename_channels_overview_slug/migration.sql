-- Rename the channels-overview lesson slug (was named after a stale "3 channels"
-- count that no longer matches the product — 6 real channels today: VALUE/SAFE/
-- DOMINANT/DRAW/BTTS/GOALS). The article content/file and
-- FORMATION_GRADUATE_ARTICLES were renamed in the same change; this preserves
-- users' completion progress by migrating the stored slug in
-- user_content_progress.
--
--   the-3-channels -> channels-overview
--
-- The unique key is (userId, contentType, slug); the new slug does not yet
-- exist, so a straight UPDATE cannot collide.

UPDATE "user_content_progress" SET "slug" = 'channels-overview' WHERE "slug" = 'the-3-channels';
