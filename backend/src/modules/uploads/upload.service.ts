import { cloudinary, configureCloudinary } from '../../shared/config/cloudinary.js';
import { env } from '../../shared/config/env.js';
import { BadRequestError, ForbiddenError } from '../../shared/errors/app-error.js';
import { UserRole, type IUser } from '../../models/index.js';

/**
 * Signed direct-to-Cloudinary uploads.
 *
 * The browser never sees the api_secret. It asks for a signature, which is
 * valid for one upload into one folder, then POSTs the file straight to
 * Cloudinary — we never proxy the bytes.
 */

/** What each kind of upload is allowed to do. */
const UPLOAD_KINDS = {
  avatar: { folder: 'avatars', maxBytes: 2 * 1024 * 1024 },
  arena: { folder: 'arenas', maxBytes: 5 * 1024 * 1024 },
  team_logo: { folder: 'teams', maxBytes: 2 * 1024 * 1024 },
  /** Dispute evidence is private — never publicly listable. */
  evidence: { folder: 'evidence', maxBytes: 5 * 1024 * 1024 },
  kyc: { folder: 'kyc', maxBytes: 5 * 1024 * 1024 },
} as const;

export type UploadKind = keyof typeof UPLOAD_KINDS;

const ALLOWED_FORMATS = ['jpg', 'jpeg', 'png', 'webp'] as const;

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
  maxBytes: number;
  allowedFormats: readonly string[];
}

/**
 * Only arena owners and admins may upload venue photos — otherwise any player
 * could push images into a venue's gallery.
 */
function assertCanUpload(user: IUser, kind: UploadKind): void {
  if (kind !== 'arena') return;

  const allowed: UserRole[] = [UserRole.ARENA_OWNER, UserRole.ADMIN, UserRole.SUPER_ADMIN];
  if (!allowed.includes(user.role)) {
    throw new ForbiddenError('Only venue owners can upload arena photos');
  }
}

export function createUploadSignature(input: {
  user: IUser;
  kind: UploadKind;
}): UploadSignature {
  if (!configureCloudinary()) {
    throw new BadRequestError('Uploads are not configured on this server');
  }

  const config = UPLOAD_KINDS[input.kind];
  if (!config) throw new BadRequestError('Unknown upload kind');

  assertCanUpload(input.user, input.kind);

  const timestamp = Math.round(Date.now() / 1000);
  /** Scoped per user so an uploaded file is always attributable. */
  const folder = `${env.CLOUDINARY_UPLOAD_FOLDER}/${config.folder}/${input.user.publicId}`;

  /**
   * The signed params are exactly what Cloudinary will enforce. Anything the
   * client adds beyond these invalidates the signature, so it cannot widen
   * the folder or lift the size cap.
   */
  const paramsToSign: Record<string, string | number> = {
    folder,
    timestamp,
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    env.CLOUDINARY_API_SECRET ?? '',
  );

  return {
    signature,
    timestamp,
    apiKey: env.CLOUDINARY_API_KEY ?? '',
    cloudName: env.CLOUDINARY_CLOUD_NAME ?? '',
    folder,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME ?? ''}/image/upload`,
    maxBytes: Math.min(config.maxBytes, env.MAX_UPLOAD_SIZE_MB * 1024 * 1024),
    allowedFormats: ALLOWED_FORMATS,
  };
}

/** Deletes an asset. Used when a venue removes a photo. */
export async function deleteAsset(publicIdPath: string): Promise<boolean> {
  if (!configureCloudinary()) return false;
  const result = await cloudinary.uploader.destroy(publicIdPath);
  return result.result === 'ok';
}

/**
 * Builds a delivery URL with transformations applied.
 * Serving a 4MB original into a list row is the fastest way to make a fast
 * app feel slow on 4G, which is most of our traffic.
 */
export function imageUrl(
  publicIdPath: string,
  options: { width?: number; height?: number } = {},
): string {
  return cloudinary.url(publicIdPath, {
    secure: true,
    fetch_format: 'auto',
    quality: 'auto',
    crop: 'fill',
    ...(options.width === undefined ? {} : { width: options.width }),
    ...(options.height === undefined ? {} : { height: options.height }),
  });
}
