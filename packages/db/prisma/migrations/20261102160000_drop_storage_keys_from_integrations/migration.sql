-- The RustFS access keys are read from the .env only (storage.service.ts):
-- a copy stored in Réglages › Intégrations drifted from the container's on
-- 2026-11-02. No field reads these rows any more.
DELETE FROM "integration_setting"
WHERE "key" IN ('storage.accessKey', 'storage.secretKey');
