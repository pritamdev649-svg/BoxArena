import pino from 'pino';
import { env, isProduction } from './env.js';

/**
 * Redaction is configured at the logger, not at each call site — relying on
 * every developer to remember is how OTPs end up in a log aggregator
 * (edge_cases.md §101).
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'password', 'otp', 'code', 'codeHash', 'token', 'tokenHash',
      'accessToken', 'refreshToken', 'authorization',
      'req.headers.authorization', 'req.headers.cookie',
      'signature', 'accountNumber', 'panNumber', 'ifsc',
      '*.password', '*.otp', '*.token', '*.signature',
    ],
    censor: '[REDACTED]',
  },
  ...(isProduction ? {} : { transport: { target: 'pino/file', options: { destination: 1 } } }),
});
