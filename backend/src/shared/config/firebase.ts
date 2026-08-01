import { cert, getApps, initializeApp, type App, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging as getFirebaseMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Firebase Admin, for FCM push only. (v14 uses the modular API — the old
 * `admin.messaging()` namespace was removed.)
 *
 * Optional by design: no credentials means no push, but the API keeps
 * working. Nobody should be unable to book a court because a service account
 * expired.
 */
let app: App | undefined;
let attempted = false;

export function getMessaging(): Messaging | undefined {
  if (!attempted) {
    attempted = true;
    app = initialise();
  }
  return app ? getFirebaseMessaging(app) : undefined;
}

function initialise(): App | undefined {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const base64 = process.env['FIREBASE_SERVICE_ACCOUNT_BASE64'];
  const projectId = process.env['FIREBASE_PROJECT_ID'];
  const clientEmail = process.env['FIREBASE_CLIENT_EMAIL'];
  /** The key contains real newlines; .env stores them escaped. */
  const privateKey = process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/gu, '\n');

  try {
    if (base64) {
      const parsed: unknown = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
      return initializeApp({ credential: cert(parsed as ServiceAccount) });
    }
    if (projectId && clientEmail && privateKey) {
      return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
    }
  } catch (err) {
    logger.error({ err }, 'Firebase Admin failed to initialise — push disabled');
    return undefined;
  }

  logger.warn({ env: env.NODE_ENV }, 'Firebase not configured — push notifications disabled');
  return undefined;
}
