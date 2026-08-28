import pino from "pino";

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";

// Always pretty-printed, in every environment — including inside Docker,
// where `docker logs` renders ANSI colors fine. A previous NODE_ENV-gated
// version fell back to raw single-line JSON in production, which is what
// made a `docker logs -f evcore-vantage-worker` session unreadable (see
// commit history). Mirrors apps/backend/src/utils/logger.ts's pino-pretty
// options for consistency across the two services' log output.
const root = pino({
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "UTC:yyyy-mm-dd HH:MM:ss.l",
      ignore: "pid,hostname",
      messageFormat: "{msg}",
      singleLine: false,
    },
  },
});

export function createLogger(name: string): pino.Logger {
  return root.child({ name });
}
