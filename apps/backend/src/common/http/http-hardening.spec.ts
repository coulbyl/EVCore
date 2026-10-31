import {
  Controller,
  Get,
  InternalServerErrorException,
  Param,
  Req,
} from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type {
  AuthenticatedRequest,
  AuthSession,
} from '@modules/auth/auth.types';
import { applyHttpHardening } from './http-hardening';
import type { RequestLogFields, RequestLogSink } from './request-log';

const LARGE_BODY = { rows: Array.from({ length: 200 }, (_, i) => `row-${i}`) };

@Controller()
class ProbeController {
  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('items/:id')
  item(@Param('id') id: string): { id: string; rows: string[] } {
    return { id, ...LARGE_BODY };
  }

  @Get('small')
  small(): { ok: boolean } {
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: AuthenticatedRequest): { ok: boolean } {
    req.authSession = {
      sessionId: 'abcdef0123456789',
    } as unknown as AuthSession;
    return { ok: true };
  }

  @Get('boom')
  boom(): never {
    throw new InternalServerErrorException();
  }
}

type Line = {
  level: 'info' | 'error';
  fields: RequestLogFields;
  message: string;
};

describe('applyHttpHardening', () => {
  let app: NestExpressApplication;
  let server: App;
  const lines: Line[] = [];
  const sink: RequestLogSink = {
    info: (fields, message) => lines.push({ level: 'info', fields, message }),
    error: (fields, message) => lines.push({ level: 'error', fields, message }),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>({
      logger: false,
    });
    applyHttpHardening(app, sink);
    app.use('/reference', (_req: unknown, res: { send(body: string): void }) =>
      res.send('<!doctype html><title>reference</title>'),
    );
    await app.init();
    server = app.getHttpServer() as App;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    lines.length = 0;
  });

  async function loggedLine(): Promise<Line> {
    await vi.waitFor(() => expect(lines).toHaveLength(1));
    return lines[0];
  }

  describe('compression', () => {
    it('gzips a body above the threshold', async () => {
      const res = await request(server)
        .get('/items/42')
        .set('Accept-Encoding', 'gzip');
      expect(res.status).toBe(200);
      expect(res.headers['content-encoding']).toBe('gzip');
      expect(res.body).toEqual({ id: '42', ...LARGE_BODY });
    });

    it('leaves a small body alone', async () => {
      const res = await request(server)
        .get('/small')
        .set('Accept-Encoding', 'gzip');
      expect(res.headers['content-encoding']).toBeUndefined();
    });
  });

  describe('ETag', () => {
    it('answers 304 without a body when the client holds the same version', async () => {
      const first = await request(server).get('/items/42');
      const etag = first.headers['etag'];
      expect(etag).toMatch(/^W\//);

      const second = await request(server)
        .get('/items/42')
        .set('If-None-Match', etag);
      expect(second.status).toBe(304);
      expect(second.text).toBe('');
    });

    it('sends the body when the version changed', async () => {
      const first = await request(server).get('/items/42');
      const other = await request(server)
        .get('/items/43')
        .set('If-None-Match', first.headers['etag']);
      expect(other.status).toBe(200);
    });
  });

  describe('security headers', () => {
    it('locks the API down', async () => {
      const res = await request(server).get('/small');
      expect(res.headers['content-security-policy']).toBe(
        "default-src 'none';frame-ancestors 'none'",
      );
      expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['strict-transport-security']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('lets the reference page run its scripts', async () => {
      const res = await request(server).get('/reference');
      expect(res.status).toBe(200);
      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('request log', () => {
    it('logs the route pattern, never the raw URL', async () => {
      await request(server).get('/items/raw-item-id?token=secret-reset-token');
      const line = await loggedLine();
      expect(line.level).toBe('info');
      expect(line.fields).toMatchObject({
        method: 'GET',
        route: '/items/:id',
        status: 200,
      });
      expect(line.fields.ms).toBeGreaterThanOrEqual(0);
      expect(line.message).toMatch(/^GET \/items\/:id 200 [\d.]+ms$/);
      expect(JSON.stringify(line)).not.toContain('secret-reset-token');
      expect(JSON.stringify(line)).not.toContain('raw-item-id');
    });

    it('carries a truncated session id when a session was read', async () => {
      await request(server).get('/me');
      const line = await loggedLine();
      expect(line.fields.session).toBe('abcdef01');
    });

    it('has no session field for an anonymous request', async () => {
      await request(server).get('/small');
      const line = await loggedLine();
      expect(line.fields).not.toHaveProperty('session');
    });

    it('logs a server error at error level', async () => {
      await request(server).get('/boom');
      const line = await loggedLine();
      expect(line.level).toBe('error');
      expect(line.fields).toMatchObject({ route: '/boom', status: 500 });
    });

    it('names unmatched paths without echoing them', async () => {
      await request(server).get('/nope/someone@example.com');
      const line = await loggedLine();
      expect(line.fields).toMatchObject({ route: 'unmatched', status: 404 });
      expect(line.message).not.toContain('example.com');
    });

    it('skips the healthcheck', async () => {
      await request(server).get('/health').expect(200);
      await request(server).get('/small');
      const line = await loggedLine();
      expect(line.fields.route).toBe('/small');
    });
  });
});
