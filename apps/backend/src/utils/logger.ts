import path from 'path';
import pino from 'pino';

const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';
const LOG_DIR = process.env['LOG_DIR'] ?? path.join(process.cwd(), 'logs');

const transport = pino.transport({
  targets: [
    {
      target: 'pino-pretty',
      level: LOG_LEVEL,
      options: {
        colorize: true,
        translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l',
        ignore: 'pid,hostname',
        messageFormat: '{msg}',
        singleLine: false,
      },
    },
    {
      target: 'pino/file',
      level: LOG_LEVEL,
      options: {
        destination: path.join(LOG_DIR, 'app.log'),
        mkdir: true,
      },
    },
  ],
});

const root = pino(
  { level: LOG_LEVEL, timestamp: pino.stdTimeFunctions.isoTime },
  transport,
);

export function createLogger(name: string): pino.Logger {
  return root.child({ name });
}
