import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { ClientSession } from 'mongoose';
import { env } from '../../shared/config/env.js';
import {
  AccountStatus,
  OtpModel,
  RefreshTokenModel,
  UserModel,
  UserRole,
  ArenaApplicationModel,
  ApplicationStatus,
  type IUser,
} from '../../models/index.js';
import { ForbiddenError, UnauthorizedError, BadRequestError } from '../../shared/errors/app-error.js';
import { publicId, referralCode } from '../../shared/utils/ids.js';
import { daysFromNow } from '../../shared/utils/datetime.js';

/**
 * Auth service. Express-free by design — callable from cron jobs and testable
 * without HTTP (code_standards.md §6).
 */

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** OTPs are never stored in plaintext (edge_cases.md §2). */
function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(`${code}${env.OTP_PEPPER}`).digest('hex');
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateOtpCode(): string {
  if (env.OTP_DEV_MODE) return env.OTP_DEV_CODE;
  const max = 10 ** env.OTP_LENGTH;
  return String(crypto.randomInt(0, max)).padStart(env.OTP_LENGTH, '0');
}

/**
 * Always succeeds from the caller's perspective — never reveal whether a
 * number is registered (api_contract.md §1).
 */
export async function requestOtp(input: {
  phoneNumber: string;
  purpose?: 'login' | 'withdrawal' | 'phone_change';
  ip?: string;
}): Promise<{ devCode?: string }> {
  const code = generateOtpCode();

  await OtpModel.create({
    phoneNumber: input.phoneNumber,
    codeHash: hashOtp(code),
    purpose: input.purpose ?? 'login',
    maxAttempts: env.OTP_MAX_ATTEMPTS,
    expiresAt: new Date(Date.now() + env.OTP_EXPIRY_SECONDS * 1000),
    ...(input.ip === undefined ? {} : { requestIp: input.ip }),
  });

  // In dev the code is returned so nobody needs an SMS gateway to log in.
  return env.OTP_DEV_MODE ? { devCode: code } : {};
}

export interface VerifyOtpResult extends TokenPair {
  user: IUser;
  isNewUser: boolean;
}

export async function verifyOtp(input: {
  phoneNumber: string;
  code: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}): Promise<VerifyOtpResult> {
  const otp = await OtpModel.findOne({
    phoneNumber: input.phoneNumber,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otp) throw new UnauthorizedError('That code has expired. Request a new one.');

  if (otp.attempts >= otp.maxAttempts) {
    throw new UnauthorizedError('Too many incorrect attempts. Request a new code.');
  }

  /** Constant-time compare — a timing oracle on a 6-digit code is real. */
  const expected = Buffer.from(otp.codeHash);
  const actual = Buffer.from(hashOtp(input.code));
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    otp.attempts += 1;
    await otp.save();
    throw new UnauthorizedError('Incorrect code');
  }

  /** Single-use: consume before issuing tokens so a replay cannot succeed. */
  otp.consumedAt = new Date();
  await otp.save();

  const { user, isNewUser } = await findOrCreateUser(input.phoneNumber);
  await assertLoginAllowed(user);

  const tokens = await issueTokenPair(user, {
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
    ...(input.ip === undefined ? {} : { ip: input.ip }),
  });

  user.lastLoginAt = new Date();
  await user.save();

  return { ...tokens, user, isNewUser };
}

async function findOrCreateUser(
  phoneNumber: string,
): Promise<{ user: IUser; isNewUser: boolean }> {
  const existing = await UserModel.findOne({ phoneNumber });
  if (existing) {
    if (!existing.phoneVerified) {
      existing.phoneVerified = true;
      await existing.save();
    }
    return { user: existing, isNewUser: false };
  }

  const user = await UserModel.create({
    publicId: publicId('usr'),
    phoneNumber,
    phoneVerified: true,
    fullName: 'New Player',
    referralCode: referralCode(),
    role: UserRole.PLAYER,
  });

  return { user, isNewUser: true };
}

async function assertLoginAllowed(user: IUser): Promise<void> {
  if (user.status === AccountStatus.SUSPENDED) {
    const application = await ArenaApplicationModel.findOne({ applicantUserId: user._id });
    if (application && application.status === ApplicationStatus.REJECTED) {
      throw new ForbiddenError(
        `Your application was rejected. Reason: ${application.rejectionReason || 'No reason specified'}`,
        'APPLICATION_REJECTED'
      );
    }
    throw new ForbiddenError('This account is suspended. Contact support.', 'ACCOUNT_SUSPENDED');
  }
  if (user.status === AccountStatus.DELETED) {
    throw new ForbiddenError('This account has been deleted.', 'ACCOUNT_SUSPENDED');
  }
  if (user.selfExcludedUntil && user.selfExcludedUntil > new Date()) {
    throw new ForbiddenError('You have self-excluded until ' + user.selfExcludedUntil.toDateString(), 'ACCOUNT_SUSPENDED');
  }
}

export interface AccessTokenClaims {
  sub: string;
  publicId: string;
  role: UserRole;
}

export async function issueTokenPair(
  user: IUser,
  context: { deviceId?: string; userAgent?: string; ip?: string },
  replacesTokenHash?: string,
  session?: ClientSession,
): Promise<TokenPair> {
  const claims: AccessTokenClaims = {
    sub: String(user._id),
    publicId: user.publicId,
    role: user.role,
  };

  const accessToken = jwt.sign(claims as object, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as NonNullable<jwt.SignOptions['expiresIn']>,
    issuer: env.JWT_ISSUER,
  });

  const refreshToken = crypto.randomBytes(48).toString('base64url');

  await RefreshTokenModel.create(
    [
      {
        userId: user._id,
        tokenHash: hashToken(refreshToken),
        expiresAt: daysFromNow(env.JWT_REFRESH_EXPIRES_DAYS),
        ...(context.deviceId === undefined ? {} : { deviceId: context.deviceId }),
        ...(context.userAgent === undefined ? {} : { userAgent: context.userAgent }),
        ...(context.ip === undefined ? {} : { ip: context.ip }),
        ...(replacesTokenHash === undefined ? {} : { replacedByTokenHash: replacesTokenHash }),
      },
    ],
    session ? { session } : {},
  );

  return { accessToken, refreshToken };
}

/**
 * Rotating refresh with REUSE DETECTION (edge_cases.md §6).
 *
 * Presenting an already-rotated token means the chain leaked — the legitimate
 * user and the attacker both hold tokens, and we cannot tell which is which.
 * The only safe response is to revoke every session for that user.
 */
export async function refreshTokens(input: {
  refreshToken: string;
  deviceId?: string;
  ip?: string;
}): Promise<TokenPair> {
  const tokenHash = hashToken(input.refreshToken);
  const stored = await RefreshTokenModel.findOne({ tokenHash });

  if (!stored) throw new UnauthorizedError('Invalid refresh token');

  if (stored.revokedAt || stored.replacedByTokenHash) {
    await RefreshTokenModel.updateMany(
      { userId: stored.userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
    );
    throw new UnauthorizedError(
      'Session security issue detected. Please sign in again.',
      'TOKEN_REUSE_DETECTED',
    );
  }

  if (stored.expiresAt < new Date()) throw new UnauthorizedError('Session expired');

  const user = await UserModel.findById(stored.userId);
  if (!user) throw new UnauthorizedError('Account no longer exists');
  await assertLoginAllowed(user);

  const pair = await issueTokenPair(user, {
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.ip === undefined ? {} : { ip: input.ip }),
  });

  stored.replacedByTokenHash = hashToken(pair.refreshToken);
  stored.revokedAt = new Date();
  await stored.save();

  return pair;
}

export async function logout(refreshToken: string): Promise<void> {
  await RefreshTokenModel.updateOne(
    { tokenHash: hashToken(refreshToken) },
    { $set: { revokedAt: new Date() } },
  );
}

export async function logoutAllSessions(userId: string): Promise<void> {
  await RefreshTokenModel.updateMany(
    { userId, revokedAt: { $exists: false } },
    { $set: { revokedAt: new Date() } },
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: env.JWT_ISSUER,
      /** 60s leeway for clock skew (edge_cases.md §10). */
      clockTolerance: 60,
    }) as AccessTokenClaims;
  } catch {
    throw new UnauthorizedError('Invalid or expired token');
  }
}

export async function listSessions(userId: string) {
  return RefreshTokenModel.find({
    userId,
    revokedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  })
    .select('deviceId userAgent ip createdAt')
    .sort({ createdAt: -1 })
    .lean();
}

export function assertE164Indian(phoneNumber: string): void {
  if (!/^\+91[6-9]\d{9}$/.test(phoneNumber)) {
    throw new BadRequestError('Enter a valid Indian mobile number');
  }
}
