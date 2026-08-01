import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Log incoming request details
  logger.info({
    type: 'request',
    method: req.method,
    url: req.originalUrl || req.url,
    query: req.query,
    body: req.body,
  }, `--> ${req.method} ${req.originalUrl || req.url}`);

  // Capture response body
  const originalSend = res.send;
  let responseBody: any = null;

  res.send = function (body) {
    responseBody = body;
    return originalSend.apply(this, arguments as any);
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    let parsedBody = responseBody;

    // If body is a string (e.g. JSON stringified), try parsing it to log as object
    if (typeof responseBody === 'string') {
      try {
        parsedBody = JSON.parse(responseBody);
      } catch {
        // Keep as string if not JSON
      }
    }

    logger.info({
      type: 'response',
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      body: parsedBody,
    }, `<-- ${req.method} ${req.originalUrl || req.url} ${res.statusCode} (${duration}ms)`);
  });

  next();
}
