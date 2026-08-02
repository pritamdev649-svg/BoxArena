import crypto from 'node:crypto';
import type { Types } from 'mongoose';
import { env } from '../../shared/config/env.js';
import {
  UserModel,
  PlayerSportStatsModel,
  OtpModel,
  AccountStatus,
  KycStatus,
  type IUser,
} from '../../models/index.js';
import { NotFoundError, UnauthorizedError } from '../../shared/errors/app-error.js';

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function getUserProfile(userId: Types.ObjectId) {
  const user = await UserModel.findById(userId).lean();
  if (!user || user.status === AccountStatus.SUSPENDED) {
    throw new NotFoundError('User');
  }
  return user;
}

export async function updateProfile(userId: Types.ObjectId, updateData: Partial<IUser>) {
  const user = await UserModel.findById(userId);
  if (!user || user.status === AccountStatus.SUSPENDED) {
    throw new NotFoundError('User');
  }

  const allowedFields: (keyof IUser)[] = [
    'fullName',
    'avatarUrl',
    'primarySport',
    'skillLevel',
    'homeAreaName',
    'dateOfBirth',
    'gender',
    'notificationPrefs',
    'monthlyDepositLimitPaise',
  ];

  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      if (field === 'notificationPrefs' && updateData[field]) {
        // Notification preferences maps merge
        const prefs = user.notificationPrefs as any;
        const newPrefs = updateData[field] as Record<string, boolean>;
        for (const [key, val] of Object.entries(newPrefs)) {
          if (typeof prefs.set === 'function') {
            prefs.set(key, val);
          } else {
            prefs[key] = val;
          }
        }
      } else {
        (user as any)[field] = updateData[field];
      }
    }
  }

  await user.save();
  return user;
}

export async function upsertFcmToken(
  userId: Types.ObjectId,
  token: string,
  platform: 'android' | 'ios' | 'web'
) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User');

  await UserModel.updateMany(
    { 'fcmTokens.token': token },
    { $pull: { fcmTokens: { token } } }
  );

  const updatedUser = await UserModel.findById(userId);
  if (!updatedUser) throw new NotFoundError('User');
  updatedUser.fcmTokens = updatedUser.fcmTokens.filter((t) => t.token !== token);
  updatedUser.fcmTokens.push({ token, platform, updatedAt: new Date() });

  await updatedUser.save();
  return updatedUser;
}

export async function removeFcmToken(userId: Types.ObjectId, token: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User');

  user.fcmTokens = user.fcmTokens.filter((t) => t.token !== token);
  await user.save();
  return user;
}

export async function getPlayerStats(userId: Types.ObjectId) {
  return PlayerSportStatsModel.find({ userId }).lean();
}

export async function getPublicProfile(publicId: string) {
  const user = await UserModel.findOne({ publicId, status: AccountStatus.ACTIVE }).lean();
  if (!user) throw new NotFoundError('User');

  const stats = await PlayerSportStatsModel.find({ userId: user._id }).lean();

  return {
    publicId: user.publicId,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    primarySport: user.primarySport,
    skillLevel: user.skillLevel,
    homeAreaName: user.homeAreaName,
    stats: stats.map((s) => ({
      sport: s.sport,
      format: s.format,
      eloRating: s.eloRating,
      matchesPlayed: s.matchesPlayed,
      wins: s.wins,
      losses: s.losses,
      draws: s.draws,
    })),
  };
}

export async function submitKyc(userId: Types.ObjectId, pan: string, documentUrl: string) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User');

  user.kyc = {
    status: KycStatus.PENDING,
    panLast4: pan.slice(-4),
    documentUrl,
  };

  await user.save();
  return user;
}

export async function linkBankAccount(
  userId: Types.ObjectId,
  bankData: {
    accountHolderName: string;
    ifsc: string;
    accountNumber: string;
    otpCode?: string;
  }
) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User');

  if (bankData.otpCode) {
    const otp = await OtpModel.findOne({
      phoneNumber: user.phoneNumber,
      consumedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });

    if (!otp) throw new UnauthorizedError('That code has expired. Request a new one.');
    if (otp.attempts >= otp.maxAttempts) {
      throw new UnauthorizedError('Too many incorrect attempts. Request a new code.');
    }

    const expected = Buffer.from(otp.codeHash);
    const actual = Buffer.from(crypto.createHash('sha256').update(`${bankData.otpCode}${env.OTP_PEPPER}`).digest('hex'));
    const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

    if (!matches) {
      otp.attempts += 1;
      await otp.save();
      throw new UnauthorizedError('Incorrect code');
    }

    otp.consumedAt = new Date();
    await otp.save();
  }

  user.bankAccount = {
    accountHolderName: bankData.accountHolderName,
    ifsc: bankData.ifsc,
    accountNumberLast4: bankData.accountNumber.slice(-4),
  };

  await user.save();
  return user;
}

export async function deleteUser(userId: Types.ObjectId) {
  const user = await UserModel.findById(userId);
  if (!user) throw new NotFoundError('User');

  const origPhone = user.phoneNumber;

  user.fullName = 'Deleted User';
  user.avatarUrl = '';
  user.status = AccountStatus.SUSPENDED;
  user.deletedAt = new Date();
  user.fcmTokens = [];
  user.phoneNumber = `deleted_${sha256(origPhone)}`;
  await user.save({ validateBeforeSave: false });

  return { success: true };
}
