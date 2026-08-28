import pino from "pino";

const LOG_LEVEL = process.env["LOG_LEVEL"] ?? "info";

const root = pino({
  level: LOG_LEVEL,
  timestamp: pino.stdTimeFunctions.isoTime,
  transport:
    process.env["NODE_ENV"] === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true } },
});

export function createLogger(name: string): pino.Logger {
  return root.child({ name });
}
