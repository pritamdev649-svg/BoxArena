import { Schema, model, Document, Types } from 'mongoose';
import {
  SportType, MatchFormat, SkillLevelType, UserRole, BookingMode, BookingSource,
  ApplicationStatus, AccountStatus, SlotStatus, BookingStatus, ChallengeStatus,
  MatchStatus, TransactionType, WalletBucket, PaymentProvider, PaymentOrderStatus,
  KycStatus, NotificationType,
} from './enums.js';

// =========================================================================
// SHARED SUB-SCHEMAS
// =========================================================================

/**
 * GeoJSON Point. REQUIRED for the Maps integration — a `2dsphere` index on
 * this is what powers "arenas within 5km of me". Order is [lng, lat] —
 * the reverse of what Google Maps shows you. Getting this backwards is the
 * single most common bug in this file; it silently puts Lucknow in Somalia.
 */
const GeoPointSchema = new Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true,
      validate: {
        validator: (v: number[]) => {
          if (!Array.isArray(v) || v.length !== 2) return false;
          const [lng, lat] = v;
          if (lng === undefined || lat === undefined) return false;
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        },
        message: 'coordinates must be [lng, lat] within valid ranges',
      },
    },
  },
  { _id: false },
);

const AddressSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    areaName: { type: String, required: true, trim: true, index: true }, // "Gomti Nagar"
    city: { type: String, required: true, default: 'Lucknow', trim: true },
    state: { type: String, required: true, default: 'Uttar Pradesh', trim: true },
    pincode: { type: String, required: true, match: /^[1-9][0-9]{5}$/ },
    /** Google Places `place_id`. Lets us re-resolve/refresh an arena's pin. */
    googlePlaceId: { type: String, index: true, sparse: true },
    /** Cached formatted address from the Geocoding API, to avoid re-billing. */
    formattedAddress: { type: String },
  },
  { _id: false },
);

// =========================================================================
// 1. USER  (auth, roles, wallet, KYC, responsible-gaming)
// =========================================================================

export interface IUser extends Document {
  publicId: string;
  phoneNumber: string;   // E.164, e.g. "+919876543210"
  phoneVerified: boolean;
  email?: string;
  fullName: string;
  avatarUrl?: string;
  dateOfBirth?: Date;    // 18+ gate for paid challenges
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  role: UserRole;
  status: AccountStatus;
  primarySport: SportType;
  skillLevel: SkillLevelType;
  homeAreaName?: string;
  lastKnownLocation?: { type: 'Point'; coordinates: [number, number] };
  fcmTokens: { token: string; platform: 'android' | 'ios' | 'web'; updatedAt: Date }[];
  notificationPrefs: Record<NotificationType, boolean> | Map<string, boolean>;
  wallet: {
    depositPaise: number;
    winningsPaise: number;
    bonusPaise: number;
    lockedPaise: number; // in escrow right now; NOT spendable
  };
  kyc: {
    status: KycStatus;
    panLast4?: string;
    documentUrl?: string;
    verifiedAt?: Date;
    rejectionReason?: string;
  };
  bankAccount?: {
    accountHolderName: string;
    ifsc: string;
    accountNumberLast4: string;
    vpa?: string; // UPI id
    razorpayFundAccountId?: string;
  };
  referralCode: string;
  referredBy?: Types.ObjectId;
  /** For ARENA_STAFF: which arena they work at. Scopes all their access. */
  employedAtArenaId?: Types.ObjectId;
  /** Gates pay-at-venue eligibility. 2 no-shows in 30 days -> prepaid only. */
  noShowCount: number;
  /** Responsible gaming — user-set ceiling on deposits per calendar month. */
  monthlyDepositLimitPaise?: number;
  selfExcludedUntil?: Date;
  lastLoginAt?: Date;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\+91[6-9]\d{9}$/, // widen when you leave India
    },
    phoneVerified: { type: Boolean, default: false },
    email: { type: String, lowercase: true, trim: true, sparse: true, index: true },
    fullName: { type: String, required: true, trim: true, maxlength: 60 },
    avatarUrl: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.PLAYER, index: true },
    status: { type: String, enum: Object.values(AccountStatus), default: AccountStatus.ACTIVE, index: true },
    primarySport: { type: String, enum: Object.values(SportType), default: SportType.BADMINTON },
    skillLevel: { type: String, enum: Object.values(SkillLevelType), default: SkillLevelType.INTERMEDIATE },
    homeAreaName: { type: String, index: true },
    lastKnownLocation: { type: GeoPointSchema, required: false },
    fcmTokens: [
      {
        _id: false,
        token: { type: String, required: true },
        platform: { type: String, enum: ['android', 'ios', 'web'], required: true },
        updatedAt: { type: Date, default: Date.now },
      },
    ],
    notificationPrefs: { type: Map, of: Boolean, default: {} },
    wallet: {
      depositPaise: { type: Number, default: 0, min: 0 },
      winningsPaise: { type: Number, default: 0, min: 0 },
      bonusPaise: { type: Number, default: 0, min: 0 },
      lockedPaise: { type: Number, default: 0, min: 0 },
    },
    kyc: {
      status: { type: String, enum: Object.values(KycStatus), default: KycStatus.NOT_SUBMITTED },
      panLast4: { type: String },
      documentUrl: { type: String },
      verifiedAt: { type: Date },
      rejectionReason: { type: String },
    },
    bankAccount: {
      accountHolderName: { type: String },
      ifsc: { type: String, match: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
      accountNumberLast4: { type: String },
      vpa: { type: String },
      razorpayFundAccountId: { type: String },
    },
    referralCode: { type: String, required: true, unique: true, index: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    employedAtArenaId: { type: Schema.Types.ObjectId, ref: 'Arena', index: true, sparse: true },
    noShowCount: { type: Number, default: 0, min: 0 },
    monthlyDepositLimitPaise: { type: Number, min: 0 },
    selfExcludedUntil: { type: Date },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

/** Spendable = every bucket except what's already escrowed. */
UserSchema.virtual('spendablePaise').get(function (this: IUser) {
  return this.wallet.depositPaise + this.wallet.winningsPaise + this.wallet.bonusPaise;
});

UserSchema.index({ lastKnownLocation: '2dsphere' });
UserSchema.index({ role: 1, status: 1 });

export const UserModel = model<IUser>('User', UserSchema);

// =========================================================================
// 2. OTP  (never store the code in plaintext)
// =========================================================================

export interface IOtp extends Document {
  phoneNumber: string;
  codeHash: string;      // bcrypt/sha256(code + OTP_PEPPER)
  purpose: 'login' | 'withdrawal' | 'phone_change';
  attempts: number;
  maxAttempts: number;
  consumedAt?: Date;
  expiresAt: Date;
  requestIp?: string;
  createdAt: Date;
}

const OtpSchema = new Schema<IOtp>(
  {
    phoneNumber: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    purpose: { type: String, enum: ['login', 'withdrawal', 'phone_change'], default: 'login' },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    consumedAt: { type: Date },
    expiresAt: { type: Date, required: true },
    requestIp: { type: String },
  },
  { timestamps: true },
);

// TTL: Mongo reaps expired OTPs automatically.
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpModel = model<IOtp>('Otp', OtpSchema);

// =========================================================================
// 3. REFRESH TOKEN / SESSION  (enables real logout + device revocation)
// =========================================================================

export interface IRefreshToken extends Document {
  userId: Types.ObjectId;
  tokenHash: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
  revokedAt?: Date;
  replacedByTokenHash?: string; // rotation chain -> detects token theft
  expiresAt: Date;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    deviceId: { type: String },
    userAgent: { type: String },
    ip: { type: String },
    revokedAt: { type: Date },
    replacedByTokenHash: { type: String },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshTokenModel = model<IRefreshToken>('RefreshToken', RefreshTokenSchema);

// =========================================================================
// 4. ARENA + COURT  (geo-indexed; one arena has many courts)
// =========================================================================

export interface IArena extends Document {
  publicId: string;
  name: string;
  slug: string;              // SEO route on the Next.js public site
  ownerId: Types.ObjectId;   // -> User with role=arena_owner
  description?: string;
  address: {
    line1: string; line2?: string; areaName: string; city: string;
    state: string; pincode: string; googlePlaceId?: string; formattedAddress?: string;
  };
  location: { type: 'Point'; coordinates: [number, number] };
  images: string[];
  sportsSupported: SportType[];
  amenities: string[];       // 'parking' | 'washroom' | 'floodlights' | 'cafeteria' | ...
  /** Weekly template. Slots are materialised from this by a cron job. */
  operatingHours: {
    dayOfWeek: number; // 0=Sun .. 6=Sat
    openTime: string;  // "06:00" local (IST)
    closeTime: string; // "23:00"
    isClosed: boolean;
  }[];
  cancellationPolicy: {
    freeCancellationHours: number;   // full refund if cancelled >= N hrs before
    partialRefundPercent: number;    // 0-100, applied inside the window
  };
  contactPhone: string;
  rating: { average: number; count: number };
  commissionPercent: number; // platform's cut. Per-arena — it's negotiated per venue.
  bookingMode: BookingMode;
  /** When pay-at-venue is allowed, the forfeitable prepaid share (0-100). */
  depositPercent: number;
  payoutAccount?: {
    accountHolderName: string;
    ifsc?: string;
    accountNumberLast4?: string;
    vpa?: string;
    panLast4?: string;
    gstin?: string;
    razorpayFundAccountId?: string;
  };
  settlementCycle: 'weekly' | 'fortnightly' | 'monthly';
  /** Staff accounts the owner has created for the front desk. */
  staffUserIds: Types.ObjectId[];
  applicationId?: Types.ObjectId;
  isVerified: boolean;
  isActive: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ArenaSchema = new Schema<IArena>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    slug: { type: String, required: true, unique: true, index: true, lowercase: true },
    ownerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    description: { type: String, maxlength: 2000 },
    address: { type: AddressSchema, required: true },
    location: { type: GeoPointSchema, required: true },
    images: [{ type: String }],
    sportsSupported: [{ type: String, enum: Object.values(SportType), required: true }],
    amenities: [{ type: String }],
    operatingHours: [
      {
        _id: false,
        dayOfWeek: { type: Number, min: 0, max: 6, required: true },
        openTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
        closeTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
        isClosed: { type: Boolean, default: false },
      },
    ],
    cancellationPolicy: {
      freeCancellationHours: { type: Number, default: 12, min: 0 },
      partialRefundPercent: { type: Number, default: 50, min: 0, max: 100 },
    },
    contactPhone: { type: String, required: true },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    commissionPercent: { type: Number, default: 10, min: 0, max: 100 },
    bookingMode: { type: String, enum: Object.values(BookingMode), default: BookingMode.PREPAID_ONLY },
    depositPercent: { type: Number, default: 20, min: 0, max: 100 },
    payoutAccount: {
      accountHolderName: { type: String },
      ifsc: { type: String, match: /^[A-Z]{4}0[A-Z0-9]{6}$/ },
      accountNumberLast4: { type: String },
      vpa: { type: String },
      panLast4: { type: String },
      gstin: { type: String },
      razorpayFundAccountId: { type: String },
    },
    settlementCycle: { type: String, enum: ['weekly', 'fortnightly', 'monthly'], default: 'weekly' },
    staffUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    applicationId: { type: Schema.Types.ObjectId, ref: 'ArenaApplication' },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

/** Powers /api/arenas/nearby?lat=..&lng=..&radiusKm=.. */
ArenaSchema.index({ location: '2dsphere' });
ArenaSchema.index({ 'address.areaName': 1, sportsSupported: 1, isActive: 1 });
ArenaSchema.index({ name: 'text', description: 'text' });

export const ArenaModel = model<IArena>('Arena', ArenaSchema);

export interface ICourt extends Document {
  arenaId: Types.ObjectId;
  name: string;              // "Court 1", "Turf A"
  sport: SportType;
  surface?: string;          // 'synthetic' | 'wooden' | 'astro_turf' | 'matte'
  isIndoor: boolean;
  capacity?: number;
  /** Base price; a SlotPricingRule may override it for peak hours. */
  basePricePerHourPaise: number;
  isActive: boolean;
}

const CourtSchema = new Schema<ICourt>(
  {
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    name: { type: String, required: true, trim: true },
    sport: { type: String, enum: Object.values(SportType), required: true, index: true },
    surface: { type: String },
    isIndoor: { type: Boolean, default: true },
    capacity: { type: Number, min: 1 },
    basePricePerHourPaise: { type: Number, required: true, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

CourtSchema.index({ arenaId: 1, name: 1 }, { unique: true });

export const CourtModel = model<ICourt>('Court', CourtSchema);

/**
 * Peak/off-peak/weekend/holiday pricing, evaluated most-specific-first.
 * Mirrors how partner apps in this market already structure it:
 *   MON-FRI 09:00-16:00 ₹300 (off-peak) | SAT-SUN ₹500 | HOLIDAY ₹550
 */
export interface IPricingRule extends Document {
  arenaId: Types.ObjectId;
  courtId?: Types.ObjectId;   // null => applies to all courts in the arena
  appliesTo: 'weekday' | 'weekend' | 'holiday' | 'specific_date' | 'custom_days';
  daysOfWeek: number[];       // used when appliesTo = 'custom_days'
  specificDate?: string;      // "2026-10-20" when appliesTo = 'specific_date'
  startTime: string;
  endTime: string;
  pricePerHourPaise: number;
  priority: number;           // higher wins
  validFrom?: Date;
  validTo?: Date;
  isActive: boolean;
}

const PricingRuleSchema = new Schema<IPricingRule>(
  {
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    courtId: { type: Schema.Types.ObjectId, ref: 'Court' },
    appliesTo: {
      type: String,
      enum: ['weekday', 'weekend', 'holiday', 'specific_date', 'custom_days'],
      default: 'custom_days',
    },
    daysOfWeek: [{ type: Number, min: 0, max: 6 }],
    specificDate: { type: String },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    pricePerHourPaise: { type: Number, required: true, min: 0 },
    priority: { type: Number, default: 0 },
    validFrom: { type: Date },
    validTo: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const PricingRuleModel = model<IPricingRule>('PricingRule', PricingRuleSchema);

// =========================================================================
// 5. SLOT  (the concurrency battleground — read edge_cases.md §2)
// =========================================================================

export interface ISlot extends Document {
  arenaId: Types.ObjectId;
  courtId: Types.ObjectId;
  sport: SportType;
  /** UTC instants. NEVER compare bare "18:00" strings across DST/timezones. */
  startAt: Date;
  endAt: Date;
  /** Denormalised IST calendar day ("2026-08-14") for cheap day queries. */
  localDate: string;
  status: SlotStatus;
  pricePaise: number;
  bookingId?: Types.ObjectId;
  heldByUserId?: Types.ObjectId;
  holdExpiresAt?: Date;
  blockedReason?: string;
  version: number; // optimistic concurrency
}

const SlotSchema = new Schema<ISlot>(
  {
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    courtId: { type: Schema.Types.ObjectId, ref: 'Court', required: true, index: true },
    sport: { type: String, enum: Object.values(SportType), required: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    localDate: { type: String, required: true, index: true },
    status: { type: String, enum: Object.values(SlotStatus), default: SlotStatus.AVAILABLE, index: true },
    pricePaise: { type: Number, required: true, min: 0 },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    heldByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    holdExpiresAt: { type: Date },
    blockedReason: { type: String },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, optimisticConcurrency: true },
);

/**
 * THE anti-double-booking guarantee. Note it is keyed on courtId, not
 * arenaId — the v1 schema's {arenaId,date,startTime} index made every court
 * after the first unbookable at any given hour.
 */
SlotSchema.index({ courtId: 1, startAt: 1 }, { unique: true });
SlotSchema.index({ arenaId: 1, localDate: 1, status: 1 });
/** Sweeper job finds abandoned checkouts with this. */
SlotSchema.index({ status: 1, holdExpiresAt: 1 });

export const SlotModel = model<ISlot>('Slot', SlotSchema);

// =========================================================================
// 6. BOOKING
// =========================================================================

export interface IBooking extends Document {
  publicId: string;
  arenaId: Types.ObjectId;
  courtId: Types.ObjectId;
  slotIds: Types.ObjectId[]; // multi-hour bookings = contiguous slots
  bookerId: Types.ObjectId;
  sport: SportType;
  startAt: Date;
  endAt: Date;
  subtotalPaise: number;
  discountPaise: number;
  couponCode?: string;
  convenienceFeePaise: number;
  totalPaise: number;
  paidFromWalletPaise: number;
  paidViaGatewayPaise: number;
  status: BookingStatus;
  source: BookingSource;
  /** Set for offline_desk / walk_in — which staff member recorded it. */
  recordedByUserId?: Types.ObjectId;
  /** Pay-at-venue: prepaid deposit taken, balance collected at the gate. */
  isPayAtVenue: boolean;
  depositPaidPaise: number;
  balanceDuePaise: number;
  cancelledAt?: Date;
  cancelledBy?: Types.ObjectId;
  cancellationReason?: string;
  refundPaise: number;
  /** Client-supplied UUID. Unique index makes retries safe. */
  idempotencyKey: string;
  checkInCode?: string; // 6-digit code the arena verifies at the gate
  checkedInAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    courtId: { type: Schema.Types.ObjectId, ref: 'Court', required: true },
    slotIds: [{ type: Schema.Types.ObjectId, ref: 'Slot', required: true }],
    bookerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sport: { type: String, enum: Object.values(SportType), required: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    subtotalPaise: { type: Number, required: true, min: 0 },
    discountPaise: { type: Number, default: 0, min: 0 },
    couponCode: { type: String },
    convenienceFeePaise: { type: Number, default: 0, min: 0 },
    totalPaise: { type: Number, required: true, min: 0 },
    paidFromWalletPaise: { type: Number, default: 0, min: 0 },
    paidViaGatewayPaise: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: Object.values(BookingStatus), default: BookingStatus.PENDING_PAYMENT, index: true },
    source: { type: String, enum: Object.values(BookingSource), default: BookingSource.APP, index: true },
    recordedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    isPayAtVenue: { type: Boolean, default: false },
    depositPaidPaise: { type: Number, default: 0, min: 0 },
    balanceDuePaise: { type: Number, default: 0, min: 0 },
    cancelledAt: { type: Date },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String },
    refundPaise: { type: Number, default: 0, min: 0 },
    idempotencyKey: { type: String, required: true, unique: true },
    checkInCode: { type: String },
    checkedInAt: { type: Date },
  },
  { timestamps: true },
);

BookingSchema.index({ bookerId: 1, startAt: -1 });
BookingSchema.index({ arenaId: 1, startAt: -1, status: 1 });

export const BookingModel = model<IBooking>('Booking', BookingSchema);

// =========================================================================
// 7. TEAM + INVITES
// =========================================================================

export enum TeamMemberRole {
  CAPTAIN = 'captain',
  VICE_CAPTAIN = 'vice_captain',
  MEMBER = 'member',
}

export interface ITeam extends Document {
  publicId: string;
  name: string;
  slug: string;
  logoUrl?: string;
  captainId: Types.ObjectId;
  sport: SportType;
  format: MatchFormat;
  members: {
    userId: Types.ObjectId;
    role: TeamMemberRole;
    joinedAt: Date;
    isActive: boolean;
  }[];
  homeAreaName?: string;
  /** Denormalised counters — cheap leaderboard reads. */
  stats: { played: number; won: number; lost: number; drawn: number };
  eloRating: number;
  isActive: boolean;
  /** True for the auto-created 1-person team backing badminton singles. */
  isPseudoTeam: boolean;
  deletedAt?: Date;
  createdAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 40 },
    slug: { type: String, required: true, lowercase: true, index: true },
    logoUrl: { type: String },
    captainId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sport: { type: String, enum: Object.values(SportType), required: true, index: true },
    format: { type: String, enum: Object.values(MatchFormat), required: true },
    members: [
      {
        _id: false,
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        role: { type: String, enum: Object.values(TeamMemberRole), default: TeamMemberRole.MEMBER },
        joinedAt: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true },
      },
    ],
    homeAreaName: { type: String },
    stats: {
      played: { type: Number, default: 0 },
      won: { type: Number, default: 0 },
      lost: { type: Number, default: 0 },
      drawn: { type: Number, default: 0 },
    },
    eloRating: { type: Number, default: 1200 },
    isActive: { type: Boolean, default: true },
    isPseudoTeam: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

/**
 * Scoped uniqueness. v1 had a GLOBAL unique on `name`, so the second person
 * in Lucknow to want "Smashers" got a hard 500. Names are unique per sport,
 * and pseudo-teams are excluded entirely.
 */
TeamSchema.index(
  { slug: 1, sport: 1 },
  { unique: true, partialFilterExpression: { isPseudoTeam: false, isActive: true } },
);
TeamSchema.index({ 'members.userId': 1 });

export const TeamModel = model<ITeam>('Team', TeamSchema);

export interface ITeamInvite extends Document {
  teamId: Types.ObjectId;
  invitedByUserId: Types.ObjectId;
  /** Random token embedded in the WhatsApp deep link. NOT the ObjectId. */
  token: string;
  invitedPhone?: string;
  maxUses: number;
  usedCount: number;
  acceptedUserIds: Types.ObjectId[];
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const TeamInviteSchema = new Schema<ITeamInvite>(
  {
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    invitedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true, index: true },
    invitedPhone: { type: String },
    maxUses: { type: Number, default: 1, min: 1 },
    usedCount: { type: Number, default: 0 },
    acceptedUserIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

TeamInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TeamInviteModel = model<ITeamInvite>('TeamInvite', TeamInviteSchema);

// =========================================================================
// 8. CHALLENGE  (escrow-bearing)
// =========================================================================

export interface IChallenge extends Document {
  publicId: string;
  sport: SportType;
  format: MatchFormat;
  creatorTeamId: Types.ObjectId;
  creatorUserId: Types.ObjectId;
  opponentTeamId?: Types.ObjectId;
  opponentUserId?: Types.ObjectId;
  bookingId: Types.ObjectId;
  arenaId: Types.ObjectId;
  startAt: Date;
  entryFeePaise: number;      // per side
  prizePoolPaise: number;     // 2*entryFee - commission
  commissionPaise: number;
  /** Only players within this band may accept. Prevents shark-vs-novice. */
  skillFilter?: SkillLevelType[];
  minEloRating?: number;
  maxEloRating?: number;
  status: ChallengeStatus;
  /** Auto-cancel + refund if unmatched by this instant. */
  matchExpiresAt: Date;
  matchedAt?: Date;
  cancelledAt?: Date;
  cancellationReason?: string;
  notes?: string;
  createdAt: Date;
}

const ChallengeSchema = new Schema<IChallenge>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    sport: { type: String, enum: Object.values(SportType), required: true, index: true },
    format: { type: String, enum: Object.values(MatchFormat), required: true },
    creatorTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    creatorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opponentTeamId: { type: Schema.Types.ObjectId, ref: 'Team', index: true },
    opponentUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    startAt: { type: Date, required: true, index: true },
    entryFeePaise: { type: Number, default: 0, min: 0 },
    prizePoolPaise: { type: Number, default: 0, min: 0 },
    commissionPaise: { type: Number, default: 0, min: 0 },
    skillFilter: [{ type: String, enum: Object.values(SkillLevelType) }],
    minEloRating: { type: Number },
    maxEloRating: { type: Number },
    status: { type: String, enum: Object.values(ChallengeStatus), default: ChallengeStatus.OPEN, index: true },
    matchExpiresAt: { type: Date, required: true, index: true },
    matchedAt: { type: Date },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
    notes: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

/** Discovery feed: open challenges for a sport, soonest first. */
ChallengeSchema.index({ status: 1, sport: 1, startAt: 1 });
/** Expiry sweeper. */
ChallengeSchema.index({ status: 1, matchExpiresAt: 1 });

export const ChallengeModel = model<IChallenge>('Challenge', ChallengeSchema);

// =========================================================================
// 9. MATCH  (dual-confirmation scoring)
// =========================================================================

/**
 * One badminton game. Named `game` per BWF terminology, but the PRD calls
 * them "sets" — both refer to the same first-to-21 unit.
 */
interface IBadmintonGame {
  gameNumber: number;      // 1..3
  creatorPoints: number;
  opponentPoints: number;
}

interface ICricketInnings {
  runs: number;
  wickets: number;
  overs: number;           // 12.4 means 12 overs 4 balls
}

interface IScorePayload {
  cricket?: { creator: ICricketInnings; opponent: ICricketInnings };
  football?: { creatorGoals: number; opponentGoals: number };
  badminton?: { games: IBadmintonGame[] };
}

export interface IMatch extends Document {
  publicId: string;
  challengeId: Types.ObjectId;
  sport: SportType;
  format: MatchFormat;
  arenaId: Types.ObjectId;
  creatorTeamId: Types.ObjectId;
  opponentTeamId: Types.ObjectId;
  /** Who actually played — needed for per-player ELO on doubles. */
  lineup: { teamId: Types.ObjectId; userIds: Types.ObjectId[] }[];
  scheduledAt: Date;
  submissions: {
    byTeamId: Types.ObjectId;
    byUserId: Types.ObjectId;
    score: IScorePayload;
    claimedWinnerTeamId?: Types.ObjectId;
    submittedAt: Date;
  }[];
  finalScore?: IScorePayload;
  winnerTeamId?: Types.ObjectId;
  isDraw: boolean;
  status: MatchStatus;
  /** After this, an unconfirmed submission is auto-accepted. See §4. */
  confirmationDeadline?: Date;
  disputeId?: Types.ObjectId;
  payoutTransactionIds: Types.ObjectId[];
  eloDelta?: { teamId: Types.ObjectId; before: number; after: number }[];
  createdAt: Date;
  updatedAt: Date;
}

const BadmintonGameSchema = new Schema<IBadmintonGame>(
  {
    gameNumber: { type: Number, required: true, min: 1, max: 3 },
    creatorPoints: { type: Number, required: true, min: 0, max: 30 },
    opponentPoints: { type: Number, required: true, min: 0, max: 30 },
  },
  { _id: false },
);

const ScorePayloadSchema = new Schema<IScorePayload>(
  {
    cricket: {
      creator: { runs: Number, wickets: Number, overs: Number },
      opponent: { runs: Number, wickets: Number, overs: Number },
    },
    football: {
      creatorGoals: { type: Number, min: 0 },
      opponentGoals: { type: Number, min: 0 },
    },
    badminton: {
      games: [BadmintonGameSchema],
    },
  },
  { _id: false },
);

const MatchSchema = new Schema<IMatch>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    challengeId: { type: Schema.Types.ObjectId, ref: 'Challenge', required: true, unique: true },
    sport: { type: String, enum: Object.values(SportType), required: true, index: true },
    format: { type: String, enum: Object.values(MatchFormat), required: true },
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    creatorTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    opponentTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    lineup: [
      {
        _id: false,
        teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
        userIds: [{ type: Schema.Types.ObjectId, ref: 'User' }],
      },
    ],
    scheduledAt: { type: Date, required: true, index: true },
    submissions: [
      {
        _id: false,
        byTeamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true },
        byUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        score: { type: ScorePayloadSchema, required: true },
        claimedWinnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
        submittedAt: { type: Date, default: Date.now },
      },
    ],
    finalScore: { type: ScorePayloadSchema },
    winnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team', index: true },
    isDraw: { type: Boolean, default: false },
    status: { type: String, enum: Object.values(MatchStatus), default: MatchStatus.SCHEDULED, index: true },
    confirmationDeadline: { type: Date },
    disputeId: { type: Schema.Types.ObjectId, ref: 'Dispute' },
    payoutTransactionIds: [{ type: Schema.Types.ObjectId, ref: 'Transaction' }],
    eloDelta: [
      {
        _id: false,
        teamId: { type: Schema.Types.ObjectId, ref: 'Team' },
        before: { type: Number },
        after: { type: Number },
      },
    ],
  },
  { timestamps: true },
);

/** Auto-resolve sweeper. */
MatchSchema.index({ status: 1, confirmationDeadline: 1 });

export const MatchModel = model<IMatch>('Match', MatchSchema);

// =========================================================================
// 10. DISPUTE  (split out of Match: has its own evidence + SLA lifecycle)
// =========================================================================

export interface IDispute extends Document {
  matchId: Types.ObjectId;
  raisedByUserId?: Types.ObjectId;
  reason: 'score_mismatch' | 'no_show' | 'foul_play' | 'venue_issue' | 'other';
  description?: string;
  evidence: { url: string; uploadedByUserId: Types.ObjectId; uploadedAt: Date }[];
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  assignedAdminId?: Types.ObjectId;
  slaDueAt: Date;
  resolution?: {
    resolvedByAdminId: Types.ObjectId;
    winnerTeamId?: Types.ObjectId;
    isVoided: boolean;
    finalScore?: IScorePayload;
    adminNote: string;
    resolvedAt: Date;
  };
  createdAt: Date;
}

const DisputeSchema = new Schema<IDispute>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: 'Match', required: true, unique: true, index: true },
    raisedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: {
      type: String,
      enum: ['score_mismatch', 'no_show', 'foul_play', 'venue_issue', 'other'],
      required: true,
    },
    description: { type: String, maxlength: 2000 },
    evidence: [
      {
        _id: false,
        url: { type: String, required: true },
        uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    status: {
      type: String,
      enum: ['open', 'under_review', 'resolved', 'escalated'],
      default: 'open',
      index: true,
    },
    assignedAdminId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    slaDueAt: { type: Date, required: true, index: true },
    resolution: {
      resolvedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
      winnerTeamId: { type: Schema.Types.ObjectId, ref: 'Team' },
      isVoided: { type: Boolean, default: false },
      finalScore: { type: ScorePayloadSchema },
      adminNote: { type: String },
      resolvedAt: { type: Date },
    },
  },
  { timestamps: true },
);

export const DisputeModel = model<IDispute>('Dispute', DisputeSchema);

// =========================================================================
// 11. TRANSACTION  (append-only ledger — the financial source of truth)
// =========================================================================

export interface ITransaction extends Document {
  publicId: string;
  userId: Types.ObjectId;
  type: TransactionType;
  /** Signed: positive = credit to user, negative = debit. */
  amountPaise: number;
  bucket: WalletBucket;
  /** Balance of `bucket` immediately after this row. Enables audit replay. */
  balanceAfterPaise: number;
  description: string;
  referenceType?: 'Booking' | 'Challenge' | 'Match' | 'PaymentOrder' | 'WithdrawalRequest';
  referenceId?: Types.ObjectId;
  /** Unique -> a retried webhook or double-tapped button cannot double-credit. */
  idempotencyKey: string;
  performedByUserId?: Types.ObjectId; // set for ADMIN_ADJUSTMENT
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(TransactionType), required: true, index: true },
    amountPaise: {
      type: Number,
      required: true,
      validate: { validator: Number.isInteger, message: 'amountPaise must be an integer' },
    },
    bucket: { type: String, enum: Object.values(WalletBucket), required: true },
    balanceAfterPaise: { type: Number, required: true, min: 0 },
    description: { type: String, required: true },
    referenceType: {
      type: String,
      enum: ['Booking', 'Challenge', 'Match', 'PaymentOrder', 'WithdrawalRequest'],
    },
    referenceId: { type: Schema.Types.ObjectId },
    idempotencyKey: { type: String, required: true, unique: true },
    performedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

/**
 * Ledger rows are immutable. This guard is the last line of defence against a
 * service-layer edit that would silently break invariant I1 (ledger sum ==
 * wallet balance). Corrections are new rows, never mutations.
 */
TransactionSchema.pre(
  ['findOneAndUpdate', 'updateOne', 'updateMany'],
  { query: true, document: false },
  function () {
    throw new Error('Transactions are append-only and cannot be modified');
  },
);

TransactionSchema.index({ userId: 1, createdAt: -1 });
TransactionSchema.index({ referenceType: 1, referenceId: 1 });

export const TransactionModel = model<ITransaction>('Transaction', TransactionSchema);

// =========================================================================
// 12. PAYMENT ORDER  (Razorpay handshake + webhook dedupe)
// =========================================================================

export interface IPaymentOrder extends Document {
  userId: Types.ObjectId;
  provider: PaymentProvider;
  providerOrderId: string;
  providerPaymentId?: string;
  providerSignature?: string;
  amountPaise: number;
  currency: string;
  status: PaymentOrderStatus;
  purpose: 'wallet_topup' | 'direct_booking';
  /** Raw webhook bodies, kept for reconciliation + chargeback defence. */
  webhookEvents: { eventId: string; event: string; payload: unknown; receivedAt: Date }[];
  failureReason?: string;
  creditedTransactionId?: Types.ObjectId;
  createdAt: Date;
}

const PaymentOrderSchema = new Schema<IPaymentOrder>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: Object.values(PaymentProvider), default: PaymentProvider.RAZORPAY },
    providerOrderId: { type: String, required: true, unique: true, index: true },
    providerPaymentId: { type: String, index: true, sparse: true },
    providerSignature: { type: String },
    amountPaise: { type: Number, required: true, min: 100 },
    currency: { type: String, default: 'INR' },
    status: { type: String, enum: Object.values(PaymentOrderStatus), default: PaymentOrderStatus.CREATED, index: true },
    purpose: { type: String, enum: ['wallet_topup', 'direct_booking'], default: 'wallet_topup' },
    webhookEvents: [
      {
        _id: false,
        eventId: { type: String, required: true },
        event: { type: String, required: true },
        payload: { type: Schema.Types.Mixed },
        receivedAt: { type: Date, default: Date.now },
      },
    ],
    failureReason: { type: String },
    creditedTransactionId: { type: Schema.Types.ObjectId, ref: 'Transaction' },
  },
  { timestamps: true },
);

/** Razorpay retries webhooks; this makes replays no-ops. */
PaymentOrderSchema.index({ 'webhookEvents.eventId': 1 });

export const PaymentOrderModel = model<IPaymentOrder>('PaymentOrder', PaymentOrderSchema);

// =========================================================================
// 13. WITHDRAWAL REQUEST  (KYC-gated, manual approval in Phase 1)
// =========================================================================

export interface IWithdrawalRequest extends Document {
  publicId: string;
  userId: Types.ObjectId;
  amountPaise: number;
  tdsPaise: number;
  netPayablePaise: number;
  status: 'pending' | 'approved' | 'processing' | 'paid' | 'rejected' | 'failed';
  destination: { type: 'bank' | 'upi'; ifsc?: string; accountLast4?: string; vpa?: string };
  providerPayoutId?: string;
  reviewedByAdminId?: Types.ObjectId;
  rejectionReason?: string;
  requestedAt: Date;
  processedAt?: Date;
}

const WithdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amountPaise: { type: Number, required: true, min: 10000 }, // ₹100 minimum
    tdsPaise: { type: Number, default: 0, min: 0 },
    netPayablePaise: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'approved', 'processing', 'paid', 'rejected', 'failed'],
      default: 'pending',
      index: true,
    },
    destination: {
      type: { type: String, enum: ['bank', 'upi'], required: true },
      ifsc: { type: String },
      accountLast4: { type: String },
      vpa: { type: String },
    },
    providerPayoutId: { type: String },
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    requestedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

export const WithdrawalRequestModel = model<IWithdrawalRequest>('WithdrawalRequest', WithdrawalRequestSchema);

// =========================================================================
// 14. PLAYER SPORT STATS  (per user × sport × format — powers ELO + leaderboard)
// =========================================================================

export interface IPlayerSportStats extends Document {
  userId: Types.ObjectId;
  sport: SportType;
  format: MatchFormat;
  eloRating: number;
  peakEloRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;   // negative = losing streak
  bestStreak: number;
  /** Badminton */
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Cricket */
  totalRuns: number;
  totalWickets: number;
  /** Football */
  goalsFor: number;
  goalsAgainst: number;
  /** Doubles chemistry: record per partner. */
  partnerRecords: { partnerUserId: Types.ObjectId; played: number; won: number }[];
  areaName?: string;       // leaderboard sharding by locality
  lastPlayedAt?: Date;
}

const PlayerSportStatsSchema = new Schema<IPlayerSportStats>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sport: { type: String, enum: Object.values(SportType), required: true },
    format: { type: String, enum: Object.values(MatchFormat), required: true },
    eloRating: { type: Number, default: 1200, index: true },
    peakEloRating: { type: Number, default: 1200 },
    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    pointsFor: { type: Number, default: 0 },
    pointsAgainst: { type: Number, default: 0 },
    totalRuns: { type: Number, default: 0 },
    totalWickets: { type: Number, default: 0 },
    goalsFor: { type: Number, default: 0 },
    goalsAgainst: { type: Number, default: 0 },
    partnerRecords: [
      {
        _id: false,
        partnerUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        played: { type: Number, default: 0 },
        won: { type: Number, default: 0 },
      },
    ],
    areaName: { type: String, index: true },
    lastPlayedAt: { type: Date },
  },
  { timestamps: true },
);

PlayerSportStatsSchema.index({ userId: 1, sport: 1, format: 1 }, { unique: true });
/** Leaderboard read path. */
PlayerSportStatsSchema.index({ sport: 1, format: 1, eloRating: -1 });
PlayerSportStatsSchema.index({ areaName: 1, sport: 1, format: 1, eloRating: -1 });

export const PlayerSportStatsModel = model<IPlayerSportStats>('PlayerSportStats', PlayerSportStatsSchema);

// =========================================================================
// 15. NOTIFICATION  (in-app inbox; FCM is only the transport)
// =========================================================================

export interface INotification extends Document {
  userId: Types.ObjectId;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>; // deep-link payload for the Flutter router
  isRead: boolean;
  readAt?: Date;
  sentViaFcm: boolean;
  fcmMessageId?: string;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: Object.values(NotificationType), required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: { type: Map, of: String },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    sentViaFcm: { type: Boolean, default: false },
    fcmMessageId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
/** Auto-purge the inbox after 90 days. */
NotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 });

export const NotificationModel = model<INotification>('Notification', NotificationSchema);

// =========================================================================
// 16. ARENA REVIEW
// =========================================================================

export interface IReview extends Document {
  arenaId: Types.ObjectId;
  userId: Types.ObjectId;
  bookingId: Types.ObjectId; // only players who actually played may review
  rating: number;
  comment?: string;
  isHidden: boolean;
  createdAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking', required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, maxlength: 1000 },
    isHidden: { type: Boolean, default: false },
  },
  { timestamps: true },
);

/** One review per booking — blocks review spam. */
ReviewSchema.index({ bookingId: 1, userId: 1 }, { unique: true });

export const ReviewModel = model<IReview>('Review', ReviewSchema);

// =========================================================================
// 17. AUDIT LOG  (every privileged action — required for RMG compliance)
// =========================================================================

export interface IAuditLog extends Document {
  actorUserId: Types.ObjectId;
  actorRole: UserRole;
  action: string;         // 'dispute.resolve', 'wallet.adjust', 'user.suspend'
  targetType: string;
  targetId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  reason?: string;
  ip?: string;
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    actorRole: { type: String, enum: Object.values(UserRole), required: true },
    action: { type: String, required: true, index: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, index: true },
    before: { type: Schema.Types.Mixed },
    after: { type: Schema.Types.Mixed },
    reason: { type: String },
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const AuditLogModel = model<IAuditLog>('AuditLog', AuditLogSchema);

// =========================================================================
// 18. APP CONFIG  (runtime kill-switches — change without redeploying)
// =========================================================================

export interface IAppConfig extends Document {
  key: string;
  value: unknown;
  description?: string;
  updatedByUserId?: Types.ObjectId;
}

const AppConfigSchema = new Schema<IAppConfig>(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: Schema.Types.Mixed, required: true },
    description: { type: String },
    updatedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

export const AppConfigModel = model<IAppConfig>('AppConfig', AppConfigSchema);

// =========================================================================
// 19. ARENA APPLICATION  (venue onboarding — see arena_onboarding.md)
// =========================================================================

/**
 * A venue's journey from lead to live arena. Deliberately SEPARATE from
 * `Arena`: an application is a sales lead that can be abandoned, duplicated,
 * or rejected, and must never pollute the live arena collection. The real
 * `Arena` is created only on ops approval.
 */
export interface IArenaApplication extends Document {
  publicId: string;
  status: ApplicationStatus;
  currentStep: number; // 1..7, for the resumable wizard
  /** Stage 1 lead capture — all that's needed to start a sales conversation. */
  lead: {
    ownerName: string;
    phoneNumber: string;
    phoneVerified: boolean;
    venueName: string;
    areaName: string;
    sports: SportType[];
    courtCount: number;
    source: 'web' | 'app' | 'field_sales' | 'referral';
  };
  applicantUserId?: Types.ObjectId;
  /** Steps 1-7. Shapes mirror the Arena/Court/PricingRule models. */
  venue?: { name: string; description?: string; contactPhone: string; images: string[] };
  location?: {
    address: Record<string, unknown>;
    coordinates: [number, number];
    /** True once the owner has dragged the pin and confirmed the gate. */
    pinConfirmedByOwner: boolean;
  };
  courts?: {
    name: string; sport: SportType; surface?: string;
    isIndoor: boolean; capacity?: number; basePricePerHourPaise: number;
  }[];
  operatingHours?: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
  pricingRules?: Record<string, unknown>[];
  amenities?: string[];
  cancellationPolicy?: { freeCancellationHours: number; partialRefundPercent: number };
  bookingMode?: BookingMode;
  payout?: Record<string, unknown>;
  agreement?: { commissionPercent: number; settlementCycle: string; acceptedAt: Date; acceptedIp: string };
  /** Ops verification checklist — every box is a trust decision. */
  verification: {
    phoneVerifiedByOps: boolean;
    pinMatchesSatellite: boolean;
    photosAuthentic: boolean;
    courtCountVerified: boolean;
    ownershipDocSeen: boolean;
    bankNameMatches: boolean;
    pricingSane: boolean;
    siteVisitedAt?: Date;
    notes?: string;
  };
  /** Flagged when another arena exists within 100m with a similar name. */
  possibleDuplicateArenaId?: Types.ObjectId;
  reviewedByAdminId?: Types.ObjectId;
  rejectionReason?: string;
  approvedArenaId?: Types.ObjectId;
  lastNudgedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ArenaApplicationSchema = new Schema<IArenaApplication>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: Object.values(ApplicationStatus), default: ApplicationStatus.SUBMITTED, index: true },
    currentStep: { type: Number, default: 0, min: 0, max: 7 },
    lead: {
      ownerName: { type: String, required: true, trim: true },
      phoneNumber: { type: String, required: true, index: true, match: /^\+91[6-9]\d{9}$/ },
      phoneVerified: { type: Boolean, default: false },
      venueName: { type: String, required: true, trim: true },
      areaName: { type: String, required: true, index: true },
      sports: [{ type: String, enum: Object.values(SportType) }],
      courtCount: { type: Number, min: 1 },
      source: { type: String, enum: ['web', 'app', 'field_sales', 'referral'], default: 'web' },
    },
    applicantUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    venue: { type: Schema.Types.Mixed },
    location: { type: Schema.Types.Mixed },
    courts: { type: [Schema.Types.Mixed] },
    operatingHours: { type: [Schema.Types.Mixed] },
    pricingRules: { type: [Schema.Types.Mixed] },
    amenities: [{ type: String }],
    cancellationPolicy: { type: Schema.Types.Mixed },
    bookingMode: { type: String, enum: Object.values(BookingMode) },
    payout: { type: Schema.Types.Mixed },
    agreement: { type: Schema.Types.Mixed },
    verification: {
      phoneVerifiedByOps: { type: Boolean, default: false },
      pinMatchesSatellite: { type: Boolean, default: false },
      photosAuthentic: { type: Boolean, default: false },
      courtCountVerified: { type: Boolean, default: false },
      ownershipDocSeen: { type: Boolean, default: false },
      bankNameMatches: { type: Boolean, default: false },
      pricingSane: { type: Boolean, default: false },
      siteVisitedAt: { type: Date },
      notes: { type: String },
    },
    possibleDuplicateArenaId: { type: Schema.Types.ObjectId, ref: 'Arena' },
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    rejectionReason: { type: String },
    approvedArenaId: { type: Schema.Types.ObjectId, ref: 'Arena' },
    lastNudgedAt: { type: Date },
    submittedAt: { type: Date },
  },
  { timestamps: true },
);

/** Ops queue + the abandoned-lead follow-up list. */
ArenaApplicationSchema.index({ status: 1, createdAt: -1 });

export const ArenaApplicationModel = model<IArenaApplication>('ArenaApplication', ArenaApplicationSchema);

// =========================================================================
// 20. SETTLEMENT  (paying arena partners — late payouts lose venues)
// =========================================================================

export interface ISettlement extends Document {
  publicId: string;
  arenaId: Types.ObjectId;
  periodStart: Date;
  periodEnd: Date;
  bookingIds: Types.ObjectId[];
  grossPaise: number;
  commissionPaise: number;
  refundsPaise: number;
  adjustmentsPaise: number;
  netPayablePaise: number;
  /** Bookings under dispute are excluded until resolved. */
  heldBookingIds: Types.ObjectId[];
  status: 'draft' | 'approved' | 'processing' | 'paid' | 'failed';
  providerPayoutId?: string;
  approvedByAdminId?: Types.ObjectId;
  paidAt?: Date;
  failureReason?: string;
  createdAt: Date;
}

const SettlementSchema = new Schema<ISettlement>(
  {
    publicId: { type: String, required: true, unique: true, index: true },
    arenaId: { type: Schema.Types.ObjectId, ref: 'Arena', required: true, index: true },
    periodStart: { type: Date, required: true },
    periodEnd: { type: Date, required: true },
    bookingIds: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
    grossPaise: { type: Number, required: true, min: 0 },
    commissionPaise: { type: Number, required: true, min: 0 },
    refundsPaise: { type: Number, default: 0, min: 0 },
    adjustmentsPaise: { type: Number, default: 0 },
    netPayablePaise: { type: Number, required: true },
    heldBookingIds: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
    status: {
      type: String,
      enum: ['draft', 'approved', 'processing', 'paid', 'failed'],
      default: 'draft',
      index: true,
    },
    providerPayoutId: { type: String },
    approvedByAdminId: { type: Schema.Types.ObjectId, ref: 'User' },
    paidAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true },
);

/** One settlement per arena per period. */
SettlementSchema.index({ arenaId: 1, periodStart: 1, periodEnd: 1 }, { unique: true });

export const SettlementModel = model<ISettlement>('Settlement', SettlementSchema);

