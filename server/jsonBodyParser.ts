import express, { ErrorRequestHandler, RequestHandler } from 'express';
import { sendError } from './http';

/*
 * JSON body parsing for the whole app, with one larger limit for POST /reports.
 *
 * Every route keeps body-parser's default 100kb limit except the attention-report save,
 * whose timeline is one point per second of class. Its worst case, sized from the
 * validator caps in attentionReports.ts:
 *   - timeline: 10,800 points × ~50 bytes ({"time":"12:34:56","value":72.33333333333333},
 *     an unrounded float average) ≈ 540 KB
 *   - participants: 200 × ~200 bytes (identity + avg/min/max/level/alertCount) ≈ 40 KB
 *   - proctoringAlerts: 10 × ~120 bytes ≈ 1 KB, plus the scalar summary fields
 * ≈ 0.6 MB in total, so 2mb leaves more than 3× headroom.
 *
 * One selector middleware picks between two parsers (rather than stacking a second
 * parser behind the global one, which would have already rejected the body).
 */

export const DEFAULT_JSON_LIMIT = '100kb';
export const REPORTS_JSON_LIMIT = '2mb';

// The final report save and the periodic live snapshot (same payload shape) share the larger limit.
const LIVE_REPORT_PATH = /^\/reports\/[^/]+\/live$/;

function isLargeReportRequest(method: string, path: string): boolean {
  return (method === 'POST' && path === '/reports') || (method === 'PUT' && LIVE_REPORT_PATH.test(path));
}

export function createJsonBodyParser(): RequestHandler {
  const defaultParser = express.json({ limit: DEFAULT_JSON_LIMIT });
  const reportsParser = express.json({ limit: REPORTS_JSON_LIMIT });
  return (req, res, next) => {
    const parser = isLargeReportRequest(req.method, req.path) ? reportsParser : defaultParser;
    parser(req, res, next);
  };
}

/**
 * Answers a body-parser 413 as the app's JSON error shape instead of Express's default
 * HTML page, so clients can show the explanation. Any other error passes through
 * untouched to the default handling.
 */
export function createJsonBodyErrorHandler(): ErrorRequestHandler {
  return (error, _req, res, next) => {
    if (error && error.type === 'entity.too.large') {
      sendError(
        res,
        413,
        'request entity too large',
        'Los datos enviados son demasiado grandes para que el servidor los procese.'
      );
      return;
    }
    next(error);
  };
}
