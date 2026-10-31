import type { NestExpressApplication } from '@nestjs/platform-express';
import compression from 'compression';
import type { RequestHandler } from 'express';
import helmet from 'helmet';
import {
  API_REFERENCE_PATH,
  HTTP_COMPRESSION_THRESHOLD_BYTES,
} from '@config/http.constants';
import { requestLog, type RequestLogSink } from './request-log';

/**
 * The HTTP layer every API response goes through (16 § 3): the request log
 * first so its duration covers everything, then the security headers, then
 * gzip. Call before `app.listen()` / `app.init()`, which registers routes.
 */
export function applyHttpHardening(
  app: NestExpressApplication,
  logSink: RequestLogSink,
): void {
  app.use(requestLog(logSink));
  app.use(securityHeaders());
  app.use(compression({ threshold: HTTP_COMPRESSION_THRESHOLD_BYTES }));
  // Express's default, stated: a weak ETag on every GET body and a 304 when
  // the client already holds it. Screens refetched unchanged cost no body.
  app.set('etag', 'weak');
}

function securityHeaders(): RequestHandler {
  // Web and API share a site (the session cookie is SameSite=Lax with a
  // shared domain), so `same-site` keeps every legitimate load working while
  // refusing other sites' no-cors embeds.
  const crossOriginResourcePolicy = { policy: 'same-site' } as const;
  // The API answers JSON: nothing in it should ever load or frame anything.
  const api = helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
    crossOriginResourcePolicy,
  });
  // The reference page runs Scalar's scripts from its CDN.
  const reference = helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy,
  });
  return (req, res, next) => {
    const handler = req.path.startsWith(API_REFERENCE_PATH) ? reference : api;
    handler(req, res, next);
  };
}
