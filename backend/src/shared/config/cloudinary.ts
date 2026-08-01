import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';
import { logger } from './logger.js';

/**
 * Cloudinary. Configured once at boot.
 *
 * The api_secret NEVER leaves the server. Clients ask us for a short-lived
 * signature scoped to a folder and upload directly to Cloudinary with it —
 * so we neither proxy the bytes nor hand out a key that can upload anything
 * anywhere (edge_cases.md §102).
 */

let isConfigured = false;

export function configureCloudinary(): boolean {
  if (isConfigured) return true;

  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;

  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    logger.warn('Cloudinary is not configured — uploads are disabled');
    return false;
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });

  isConfigured = true;
  logger.info({ cloud: CLOUDINARY_CLOUD_NAME }, 'Cloudinary configured');
  return true;
}

/**
 * Verifies the credentials actually work, rather than just being present.
 *
 * Deliberately non-blocking: a bad upload key must not stop players booking
 * courts. But it fails LOUDLY at boot — otherwise the first symptom is a
 * venue owner watching a photo upload fail with a Cloudinary error nobody
 * on our side can interpret.
 */
export async function verifyCloudinary(): Promise<boolean> {
  if (!configureCloudinary()) return false;

  try {
    await cloudinary.api.ping();
    logger.info('Cloudinary credentials verified');
    return true;
  } catch (err) {
    logger.error(
      { err, cloud: env.CLOUDINARY_CLOUD_NAME },
      'CLOUDINARY CREDENTIALS REJECTED — image uploads will fail. ' +
        'Re-copy cloud name, API key and API secret from the Cloudinary console ' +
        '(Settings > API Keys); they must all come from the SAME cloud.',
    );
    isConfigured = false;
    return false;
  }
}

export { cloudinary };
