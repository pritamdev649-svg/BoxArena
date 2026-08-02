import 'dotenv/config';
import { z } from 'zod';

/**
 * The ONLY place in the codebase that reads process.env
 * (code_standards.md §6). Everything else imports the typed, frozen `env`.
 *
 * The server crashes on invalid config by design: a process that boots with a
 * blank RAZORPAY_WEBHOOK_SECRET will happily accept forged payment webhooks.
 */

const bool = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined ? defaultValue : v === 'true'));

const int = (defaultValue: number) =>
  z.coerce.number().int().optional().default(defaultValue);

/** Comma-separated list, trimmed and emptied of blanks. */
const csv = (defaultValue: string) =>
  z
    .string()
    .optional()
    .default(defaultValue)
    .transform((value) => value.split(',').map((part) => part.trim()).filter(Boolean));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: int(5000),
  API_BASE_URL: z.string().url().default('http://localhost:5000'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('debug'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),

  MONGODB_URI: z.string().min(1),
  MONGODB_MAX_POOL_SIZE: int(20),
  REDIS_URL: z.string().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be >= 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be >= 32 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_DAYS: int(30),
  JWT_ISSUER: z.string().default('boxarena'),

  OTP_LENGTH: int(6),
  OTP_EXPIRY_SECONDS: int(300),
  OTP_MAX_ATTEMPTS: int(5),
  OTP_PEPPER: z.string().min(16),
  OTP_DEV_MODE: bool(true),
  OTP_DEV_CODE: z.string().default('123456'),

  GOOGLE_MAPS_SERVER_API_KEY: z.string().optional(),
  GEO_DEFAULT_LAT: z.coerce.number().default(26.8467),
  GEO_DEFAULT_LNG: z.coerce.number().default(80.9462),
  GEO_MAX_RADIUS_KM: int(50),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  ENABLE_MOCK_PAYMENTS: bool(true),
  /**
   * Withdrawals move real money out and need a payout provider plus a
   * reviewed queue. Off by default so the route exists and is testable
   * without being reachable in an environment that cannot honour it.
   */
  ENABLE_WITHDRAWALS: bool(false),

  /**
   * Cloudinary. Uploads are SIGNED server-side — the api_secret never reaches
   * a client, and the signature scopes what the browser is allowed to upload
   * (edge_cases.md §102).
   */
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),
  CLOUDINARY_UPLOAD_FOLDER: z.string().default('boxarena'),
  MAX_UPLOAD_SIZE_MB: int(5),

  PLATFORM_COMMISSION_PERCENT: int(10),
  MIN_ENTRY_FEE_PAISE: int(0),
  /**
   * Sports a VENUE may list and a player may book.
   *
   * Deliberately everything: a venue owner sells the courts they actually
   * have, and telling a turf owner they cannot list their football pitch
   * because of our competitive scope would be absurd.
   */
  BOOKABLE_SPORTS: csv('badminton,cricket,football'),
  /**
   * Sports a COMPETITIVE CHALLENGE can be posted in.
   *
   * Badminton only for now. Booking a cricket pitch is fine; staking money on
   * a cricket result is not, because nothing verifies that result to the
   * standard the prize model needs.
   */
  CHALLENGE_SPORTS: csv('badminton'),
  /**
   * Sports an official can score rally-by-rally. Badminton is the reference
   * implementation; cricket's engine (balls/overs) is deliberately on hold.
   */
  LIVE_SCORING_SPORTS: csv('badminton'),
  MAX_ENTRY_FEE_PAISE: int(500_000),
  /**
   * Question Q6, and a LEGAL decision rather than an engineering one.
   *
   * `false` (default): the cap limits the STAKE only. Venue and official fees
   * are service charges for a service actually delivered — not at risk, not
   * winnable — and counting them would mean a venue raising its hourly rate
   * silently lowers how much players may stake, which is incoherent.
   *
   * `true`: the cap limits a player's total outlay per match. Set this if
   * counsel reads the limit as "what a player can lose".
   */
  ENTRY_CAP_INCLUDES_MATCH_COSTS: bool(false),
  MIN_WITHDRAWAL_PAISE: int(10_000),
  SLOT_HOLD_DURATION_SECONDS: int(300),
  SLOT_HOLD_EXTENDED_SECONDS: int(900),
  MIN_BOOKING_LEAD_MINUTES: int(30),
  /** Platform's cut of an official's fee, taken at payout (featuredoc/11 §OF4). */
  OFFICIAL_COMMISSION_PERCENT: int(10),
  SLOT_MATERIALISATION_DAYS: int(30),
  SCORE_CONFIRMATION_WINDOW_MINUTES: int(1440),
  MATCH_VOID_AFTER_HOURS: int(72),
  CHALLENGE_MATCH_WINDOW_MINUTES: int(60),
  DISPUTE_SLA_HOURS: int(48),
  DEFAULT_ELO_RATING: int(1200),
  ELO_K_FACTOR: int(32),

  ENABLE_PAID_CHALLENGES: bool(false),
  MIN_AGE_FOR_PAID_PLAY: int(18),
  REQUIRE_KYC_FOR_WITHDRAWAL: bool(true),

  RATE_LIMIT_GLOBAL_PER_MINUTE: int(100),
  RATE_LIMIT_AUTH_PER_MINUTE: int(5),
  RATE_LIMIT_OTP_PER_15_MIN: int(3),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = Object.freeze(parsed.data);
export type Env = typeof env;

/**
 * Production guards. These combinations are individually valid but together
 * mean real users can be paid with fake money — refuse to boot.
 */
if (env.NODE_ENV === 'production') {
  const fatal: string[] = [];
  if (env.ENABLE_MOCK_PAYMENTS) fatal.push('ENABLE_MOCK_PAYMENTS must be false in production');
  if (env.OTP_DEV_MODE) fatal.push('OTP_DEV_MODE must be false in production');
  if (!env.RAZORPAY_WEBHOOK_SECRET) fatal.push('RAZORPAY_WEBHOOK_SECRET is required in production');
  if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    fatal.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ');
  }
  if (fatal.length > 0) throw new Error(`Unsafe production config:\n  ${fatal.join('\n  ')}`);
}

export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';
