-- Per-query statistics: calls, mean and total time, rows, buffers. The
-- library is loaded by the server (shared_preload_libraries, compose); the
-- view answers once Postgres has restarted with it. Read with:
--   SELECT calls, round(mean_exec_time::numeric, 2) AS mean_ms,
--          round(total_exec_time::numeric) AS total_ms, left(query, 120)
--   FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
