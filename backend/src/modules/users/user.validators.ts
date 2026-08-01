import { z } from 'zod';
import { SportType, SkillLevelType } from '../../models/enums.js';

export const patchMeSchema = z
  .object({
    fullName: z.string().min(2).max(60).optional(),
    avatarUrl: z.string().url().or(z.string().max(0)).optional(),
    primarySport: z.nativeEnum(SportType).optional(),
    skillLevel: z.nativeEnum(SkillLevelType).optional(),
    homeAreaName: z.string().max(100).optional(),
    dateOfBirth: z.string().datetime().or(z.coerce.date()).optional(),
    gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
    notificationPrefs: z.record(z.string(), z.boolean()).optional(),
    monthlyDepositLimitPaise: z.number().int().min(0).optional(),
  })
  .strict();

export const fcmTokenSchema = z
  .object({
    token: z.string().min(1),
    platform: z.enum(['android', 'ios', 'web']),
  })
  .strict();

export const kycSchema = z
  .object({
    pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format'),
    documentUrl: z.string().url(),
  })
  .strict();

export const bankAccountSchema = z
  .object({
    accountHolderName: z.string().min(2).max(60),
    ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC format'),
    accountNumber: z.string().min(9).max(18),
    otpCode: z.string().length(6).optional(),
  })
  .strict();
