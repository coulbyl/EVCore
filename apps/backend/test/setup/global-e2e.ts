import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

function runMigrations(): void {
  const rootDir = resolve(process.cwd(), '../..');
  execFileSync(
    'pnpm',
    ['--filter', '@evcore/db', 'exec', 'prisma', 'migrate', 'deploy'],
    {
      cwd: rootDir,
      stdio: 'inherit',
      env: process.env,
    },
  );
}

export default async function globalSetup() {
  let container: {
    stop: () => Promise<unknown>;
    getConnectionUri: () => string;
  };
  try {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      [
        'Unable to start Testcontainers PostgreSQL for e2e tests.',
        'Start Docker (or another supported container runtime).',
        `Original error: ${details}`,
      ].join(' '),
    );
  }

  process.env['DATABASE_URL'] = container.getConnectionUri();
  process.env['NOVU_ALERTS_ENABLED'] = 'false';
  process.env['NODE_ENV'] = 'test';

  runMigrations();

  return async () => {
    await container.stop();
  };
}
