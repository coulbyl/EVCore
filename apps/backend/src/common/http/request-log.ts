import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  REQUEST_LOG_SESSION_PREFIX_LENGTH,
  REQUEST_LOG_SKIPPED_PATHS,
} from '@config/http.constants';
import type { AuthenticatedRequest } from '@modules/auth/auth.types';

/** Where request lines go: the pino `http` logger in production. */
export type RequestLogSink = {
  info(fields: RequestLogFields, message: string): void;
  error(fields: RequestLogFields, message: string): void;
};

export type RequestLogFields = {
  method: string;
  route: string;
  /** HTTP status, or `aborted` when the client left before the response. */
  status: number | 'aborted';
  ms: number;
  session?: string;
};

/**
 * One line per API request with its duration, matched route, status and a
 * truncated session id, so the p95 of each endpoint can be read from the
 * production log (16-performance-et-qualite.md § 3, « Journal »).
 *
 * The route is the matched pattern (`/coupons/:id`), never the raw URL: a
 * path or query can carry a reset token or an email. Unmatched requests are
 * logged as `unmatched`.
 */
export function requestLog(sink: RequestLogSink): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (REQUEST_LOG_SKIPPED_PATHS.includes(req.path)) {
      next();
      return;
    }
    const startedAt = process.hrtime.bigint();
    res.once('close', () => {
      const fields = requestFields(req, res, startedAt);
      const message = `${fields.method} ${fields.route} ${fields.status} ${fields.ms}ms`;
      if (fields.status === 'aborted' || fields.status >= 500) {
        sink.error(fields, message);
      } else {
        sink.info(fields, message);
      }
    });
    next();
  };
}

function requestFields(
  req: Request,
  res: Response,
  startedAt: bigint,
): RequestLogFields {
  const elapsedNs = process.hrtime.bigint() - startedAt;
  const fields: RequestLogFields = {
    method: req.method,
    route: matchedRoute(req),
    status: res.writableFinished ? res.statusCode : 'aborted',
    ms: Math.round(Number(elapsedNs) / 100_000) / 10,
  };
  const sessionId = (req as AuthenticatedRequest).authSession?.sessionId;
  if (sessionId) {
    fields.session = sessionId.slice(0, REQUEST_LOG_SESSION_PREFIX_LENGTH);
  }
  return fields;
}

function matchedRoute(req: Request): string {
  const route: unknown = req.route;
  if (
    typeof route === 'object' &&
    route !== null &&
    'path' in route &&
    typeof route.path === 'string'
  ) {
    return `${req.baseUrl}${route.path}`;
  }
  return 'unmatched';
}
