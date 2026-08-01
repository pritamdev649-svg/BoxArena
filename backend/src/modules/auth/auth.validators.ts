import { z } from 'zod';

/** .strict() everywhere — unknown keys are rejected, not silently dropped. */
const phoneNumber = z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter a valid Indian mobile number');

export const requestOtpSchema = z.object({ phoneNumber }).strict();

export const verifyOtpSchema = z
  .object({
    phoneNumber,
    code: z.string().min(4).max(8),
    deviceId: z.string().max(128).optional(),
  })
  .strict();

export const refreshSchema = z.object({ refreshToken: z.string().min(16) }).strict();
