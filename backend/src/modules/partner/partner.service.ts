import crypto from 'node:crypto';
import { z } from 'zod';
import type { Types } from 'mongoose';
import { env } from '../../shared/config/env.js';
import {
  ArenaModel,
  BookingModel,
  BookingSource,
  BookingStatus,
  CourtModel,
  SlotModel,
  SlotStatus,
  UserModel,
  UserRole,
  ArenaApplicationModel,
  ApplicationStatus,
  BookingMode,
  SportType,
  OtpModel,
  AccountStatus,
  type IArena,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  SlotUnavailableError,
} from '../../shared/errors/app-error.js';
import { checkInCode, publicId, referralCode } from '../../shared/utils/ids.js';
import { toLocalDate } from '../../shared/utils/datetime.js';
import { requestOtp, issueTokenPair } from '../auth/auth.service.js';

/**
 * Arena partner panel (arena_onboarding.md §7).
 *
 * EVERY function here scopes to arenas the caller owns or is employed at.
 * Scoping lives in this service layer, not in the controller — an owner
 * reading another venue's bookings is the most likely real vulnerability in a
 * generated codebase (edge_cases.md §96).
 */

/**
 * Resolves which arenas a caller may act on. Owners get the arenas they own;
 * staff get exactly the one arena that employs them.
 */
export async function accessibleArenaIds(user: IUser): Promise<Types.ObjectId[]> {
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) {
    const all = await ArenaModel.find().select('_id').lean();
    return all.map((a) => a._id as Types.ObjectId);
  }

  if (user.role === UserRole.ARENA_STAFF) {
    return user.employedAtArenaId ? [user.employedAtArenaId] : [];
  }

  if (user.role === UserRole.ARENA_OWNER) {
    const owned = await ArenaModel.find({ ownerId: user._id }).select('_id').lean();
    return owned.map((a) => a._id as Types.ObjectId);
  }

  return [];
}

export async function assertCanAccessArena(user: IUser, arenaId: Types.ObjectId): Promise<IArena> {
  const allowed = await accessibleArenaIds(user);
  if (!allowed.some((id) => String(id) === String(arenaId))) {
    throw new ForbiddenError('You do not manage this venue');
  }
  const arena = await ArenaModel.findById(arenaId);
  if (!arena) throw new NotFoundError('Arena');
  return arena;
}

/** Owner-only actions. Desk staff must never see money or pricing (§117). */
export function assertOwner(user: IUser): void {
  if (user.role === UserRole.ARENA_OWNER) return;
  if (user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN) return;
  throw new ForbiddenError('Only the venue owner can do this');
}

export interface OwnerDashboard {
  gtvPaise: number;
  bookingCount: number;
  onlineCount: number;
  offlineCount: number;
  cancelledCount: number;
  noShowCount: number;
  occupancyPercent: number;
  upcomingCount: number;
}

/**
 * GTV leads because owners think in revenue, not in feature usage — it is the
 * headline number in every partner app in this market (competitive_analysis.md §6).
 */
export async function getOwnerDashboard(
  user: IUser,
  periodDays = 30,
): Promise<OwnerDashboard> {
  const arenaIds = await accessibleArenaIds(user);
  if (arenaIds.length === 0) {
    return {
      gtvPaise: 0, bookingCount: 0, onlineCount: 0, offlineCount: 0,
      cancelledCount: 0, noShowCount: 0, occupancyPercent: 0, upcomingCount: 0,
    };
  }

  const since = new Date(Date.now() - periodDays * 86_400_000);
  const scope = { arenaId: { $in: arenaIds }, startAt: { $gte: since } };

  const [bookings, slotTotal, slotBooked, upcoming] = await Promise.all([
    BookingModel.find(scope).select('totalPaise status source').lean(),
    SlotModel.countDocuments({ arenaId: { $in: arenaIds }, startAt: { $gte: since } }),
    SlotModel.countDocuments({
      arenaId: { $in: arenaIds },
      startAt: { $gte: since },
      status: SlotStatus.BOOKED,
    }),
    BookingModel.countDocuments({
      arenaId: { $in: arenaIds },
      startAt: { $gte: new Date() },
      status: BookingStatus.CONFIRMED,
    }),
  ]);

  const confirmed = bookings.filter((b) => b.status === BookingStatus.CONFIRMED);

  return {
    gtvPaise: confirmed.reduce((sum, b) => sum + b.totalPaise, 0),
    bookingCount: confirmed.length,
    onlineCount: confirmed.filter(
      (b) => b.source === BookingSource.APP || b.source === BookingSource.WEB,
    ).length,
    offlineCount: confirmed.filter(
      (b) => b.source === BookingSource.OFFLINE_DESK || b.source === BookingSource.WALK_IN,
    ).length,
    cancelledCount: bookings.filter(
      (b) =>
        b.status === BookingStatus.CANCELLED_BY_USER ||
        b.status === BookingStatus.CANCELLED_BY_ARENA,
    ).length,
    noShowCount: bookings.filter((b) => b.status === BookingStatus.NO_SHOW).length,
    occupancyPercent: slotTotal === 0 ? 0 : Math.round((slotBooked / slotTotal) * 100),
    upcomingCount: upcoming,
  };
}

export async function listOwnerBookings(
  user: IUser,
  filter: { date?: string; status?: BookingStatus; limit?: number },
) {
  const arenaIds = await accessibleArenaIds(user);
  if (arenaIds.length === 0) return [];

  const query: Record<string, unknown> = { arenaId: { $in: arenaIds } };
  if (filter.status) query['status'] = filter.status;

  if (filter.date) {
    /** Range on the instant, never string equality — a 23:00 slot ends on the
        next calendar day (edge_cases.md §18). */
    const dayStart = new Date(`${filter.date}T00:00:00+05:30`);
    query['startAt'] = { $gte: dayStart, $lt: new Date(dayStart.getTime() + 86_400_000) };
  }

  return BookingModel.find(query)
    .sort({ startAt: 1 })
    .limit(Math.min(filter.limit ?? 100, 200))
    .populate('bookerId', 'fullName phoneNumber publicId')
    .populate('courtId', 'name sport')
    .lean();
}

/**
 * Records a walk-in or phone booking taken at the desk.
 *
 * Without this, arenas sell courts we then sell again online and it is OUR
 * name on the failure (edge_cases.md §115). Must be the fastest screen in the
 * panel or staff will not use it and the inventory will be wrong.
 */
export async function recordOfflineBooking(input: {
  user: IUser;
  slotIds: string[];
  customerName: string;
  customerPhone?: string;
}) {
  if (input.slotIds.length === 0) throw new BadRequestError('Select at least one slot');

  return withTransaction(async (session) => {
    const slots = await SlotModel.find({ _id: { $in: input.slotIds } })
      .sort({ startAt: 1 })
      .session(session);

    if (slots.length !== input.slotIds.length) throw new NotFoundError('Slot');

    const first = slots[0];
    const last = slots[slots.length - 1];
    if (!first || !last) throw new BadRequestError('Select at least one slot');

    const arena = await assertCanAccessArena(input.user, first.arenaId);

    /** Same atomic guard as the player path — the desk can lose a race too. */
    for (const slot of slots) {
      const claimed = await SlotModel.findOneAndUpdate(
        { _id: slot._id, status: SlotStatus.AVAILABLE },
        { $set: { status: SlotStatus.BOOKED }, $inc: { version: 1 } },
        { returnDocument: 'after', session },
      );
      if (!claimed) throw new SlotUnavailableError('That slot was just taken');
    }

    const subtotalPaise = slots.reduce((sum, s) => sum + s.pricePaise, 0);

    const [booking] = await BookingModel.create(
      [
        {
          publicId: publicId('bkg'),
          arenaId: arena._id,
          courtId: first.courtId,
          slotIds: slots.map((s) => s._id),
          /** Walk-ins have no app account; the desk staff owns the record. */
          bookerId: input.user._id,
          recordedByUserId: input.user._id,
          sport: first.sport,
          startAt: first.startAt,
          endAt: last.endAt,
          subtotalPaise,
          totalPaise: subtotalPaise,
          paidFromWalletPaise: 0,
          balanceDuePaise: subtotalPaise,
          status: BookingStatus.CONFIRMED,
          source: BookingSource.OFFLINE_DESK,
          idempotencyKey: `offline:${String(first._id)}:${Date.now().toString(36)}`,
          checkInCode: checkInCode(),
          cancellationReason: `Walk-in: ${input.customerName}${
            input.customerPhone ? ` (${input.customerPhone})` : ''
          }`,
        },
      ],
      { session },
    );

    if (!booking) throw new Error('Offline booking creation returned nothing');

    await SlotModel.updateMany(
      { _id: { $in: input.slotIds } },
      { $set: { bookingId: booking._id } },
      { session },
    );

    return booking;
  });
}

export async function checkInBooking(user: IUser, bookingPublicId: string, code: string) {
  const booking = await BookingModel.findOne({ publicId: bookingPublicId });
  if (!booking) throw new NotFoundError('Booking');

  await assertCanAccessArena(user, booking.arenaId);

  if (booking.status !== BookingStatus.CONFIRMED) {
    throw new BadRequestError('This booking is not confirmed');
  }
  if (booking.checkInCode !== code) {
    throw new BadRequestError('That check-in code does not match');
  }

  booking.checkedInAt = new Date();
  await booking.save();
  return booking;
}

/** Repeat no-shows lose the pay-at-venue option entirely (§116). */
export async function markNoShow(user: IUser, bookingPublicId: string) {
  const booking = await BookingModel.findOne({ publicId: bookingPublicId });
  if (!booking) throw new NotFoundError('Booking');

  await assertCanAccessArena(user, booking.arenaId);

  if (booking.startAt > new Date()) {
    throw new BadRequestError('This slot has not started yet');
  }

  booking.status = BookingStatus.NO_SHOW;
  await booking.save();
  await UserModel.updateOne({ _id: booking.bookerId }, { $inc: { noShowCount: 1 } });

  return booking;
}

/**
 * Blocks slots for maintenance or rain. Any booking caught in the range is the
 * ARENA'S fault, so it refunds in full regardless of policy (§19).
 */
export async function blockSlots(input: {
  user: IUser;
  courtId: string;
  from: Date;
  to: Date;
  reason: string;
}) {
  const court = await CourtModel.findById(input.courtId);
  if (!court) throw new NotFoundError('Court');

  await assertCanAccessArena(input.user, court.arenaId);

  const affected = await BookingModel.find({
    courtId: court._id,
    startAt: { $gte: input.from, $lt: input.to },
    status: BookingStatus.CONFIRMED,
  })
    .select('publicId startAt')
    .lean();

  const result = await SlotModel.updateMany(
    {
      courtId: court._id,
      startAt: { $gte: input.from, $lt: input.to },
      status: SlotStatus.AVAILABLE,
    },
    { $set: { status: SlotStatus.BLOCKED, blockedReason: input.reason } },
  );

  return {
    blockedCount: result.modifiedCount,
    /** Surfaced so the owner must explicitly cancel these, triggering refunds. */
    conflictingBookings: affected,
  };
}

export async function listOwnerArenas(user: IUser) {
  const arenaIds = await accessibleArenaIds(user);
  const arenas = await ArenaModel.find({ _id: { $in: arenaIds } }).lean();

  return Promise.all(
    arenas.map(async (arena) => {
      let verificationStatus = 'approved';
      let rejectionReason: string | undefined = undefined;

      if (arena.applicationId) {
        const application = await ArenaApplicationModel.findById(arena.applicationId).lean();
        if (application) {
          verificationStatus = application.status;
          rejectionReason = application.rejectionReason;
        }
      } else if (!arena.isVerified) {
        verificationStatus = 'pending_verification';
      }

      return {
        ...arena,
        verificationStatus,
        rejectionReason,
        courts: await CourtModel.find({ arenaId: arena._id, isActive: true }).lean(),
        todayBookings: await BookingModel.countDocuments({
          arenaId: arena._id,
          status: BookingStatus.CONFIRMED,
          startAt: {
            $gte: new Date(`${toLocalDate(new Date())}T00:00:00+05:30`),
            $lt: new Date(`${toLocalDate(new Date())}T00:00:00+05:30`).valueOf() + 86_400_000,
          },
        }),
      };
    }),
  );
}

export async function listStaff(user: IUser) {
  assertOwner(user);
  const arenaIds = await accessibleArenaIds(user);
  return UserModel.find({ role: UserRole.ARENA_STAFF, employedAtArenaId: { $in: arenaIds } })
    .select('publicId fullName phoneNumber employedAtArenaId createdAt')
    .lean();
}

function hashOtp(code: string): string {
  return crypto.createHash('sha256').update(`${code}${env.OTP_PEPPER}`).digest('hex');
}

export async function partnerApply(leadData: {
  ownerName: string;
  phoneNumber: string;
  venueName: string;
  areaName: string;
  sports: string[];
  courtCount: number;
  source?: 'web' | 'app' | 'field_sales' | 'referral';
}, ip?: string) {
  const application = await ArenaApplicationModel.create({
    publicId: publicId('apn'),
    status: ApplicationStatus.SUBMITTED,
    currentStep: 0,
    lead: {
      ownerName: leadData.ownerName,
      phoneNumber: leadData.phoneNumber,
      venueName: leadData.venueName,
      areaName: leadData.areaName,
      sports: leadData.sports as any,
      courtCount: leadData.courtCount,
      source: leadData.source || 'web',
      phoneVerified: false,
    },
    verification: {},
  });

  const otpRes = await requestOtp({
    phoneNumber: leadData.phoneNumber,
    purpose: 'login',
    ...(ip !== undefined ? { ip } : {}),
  });

  return {
    application,
    devCode: otpRes.devCode,
  };
}

export async function partnerVerifyPhone(input: {
  applicationPublicId: string;
  otpCode: string;
  deviceId?: string;
  userAgent?: string;
  ip?: string;
}) {
  const application = await ArenaApplicationModel.findOne({ publicId: input.applicationPublicId });
  if (!application) throw new NotFoundError('Application');

  const otp = await OtpModel.findOne({
    phoneNumber: application.lead.phoneNumber,
    consumedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otp) throw new BadRequestError('Verification code expired or invalid');
  if (otp.attempts >= otp.maxAttempts) {
    throw new BadRequestError('Too many incorrect verification attempts');
  }

  const expected = Buffer.from(otp.codeHash);
  const actual = Buffer.from(hashOtp(input.otpCode));
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    otp.attempts += 1;
    await otp.save();
    throw new BadRequestError('Incorrect verification code');
  }

  otp.consumedAt = new Date();
  await otp.save();

  // Update lead verified status
  application.lead.phoneVerified = true;
  application.status = ApplicationStatus.IN_PROGRESS;

  // Create or retrieve Owner User
  let user = await UserModel.findOne({ phoneNumber: application.lead.phoneNumber });
  if (!user) {
    user = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: application.lead.phoneNumber,
      phoneVerified: true,
      fullName: application.lead.ownerName,
      role: UserRole.ARENA_OWNER,
      status: AccountStatus.ACTIVE,
      referralCode: referralCode(),
    });
  } else if (user.role === UserRole.PLAYER) {
    user.role = UserRole.ARENA_OWNER;
    await user.save();
  }

  application.applicantUserId = user._id as Types.ObjectId;
  await application.save();

  // Issue session token pair
  const tokens = await issueTokenPair(user, {
    ...(input.deviceId === undefined ? {} : { deviceId: input.deviceId }),
    ...(input.userAgent === undefined ? {} : { userAgent: input.userAgent }),
    ...(input.ip === undefined ? {} : { ip: input.ip }),
  });

  return {
    ...tokens,
    user,
    application,
  };
}

export async function getPartnerApplication(userId: Types.ObjectId) {
  const application = await ArenaApplicationModel.findOne({
    applicantUserId: userId,
    status: ApplicationStatus.IN_PROGRESS,
  }).lean();
  
  if (!application) throw new NotFoundError('Application');
  return application;
}

/**
 * One wizard step, validated.
 *
 * Each step has its own shape, so validation lives here rather than in the
 * route: the route only knows a number. This used to accept `any`, which meant
 * an application could reach the ops queue with a court priced at `"free"` or
 * a pin in the Bay of Bengal, and the first person to find out was whoever
 * tried to approve it.
 */
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'Use HH:MM, 24-hour');

const stepSchemas = {
  1: z.object({
    name: z.string().min(2).max(120),
    description: z.string().max(2000).optional(),
    contactPhone: z.string().regex(/^[6-9]\d{9}$/u, 'Enter a 10-digit Indian mobile number'),
    /** Three photos minimum — the single biggest driver of booking conversion. */
    images: z.array(z.string().url()).min(3, 'Add at least 3 photos').max(10),
  }),

  2: z.object({
    address: z.object({
      formattedAddress: z.string().min(5),
      areaName: z.string().min(2),
      city: z.string().min(2).default('Lucknow'),
      pincode: z.string().regex(/^\d{6}$/u).optional(),
      googlePlaceId: z.string().optional(),
    }),
    /**
     * [lng, lat], bounded to India. A pin outside these bounds is a
     * transposed pair or a mis-drag, and a venue that geocodes into the sea
     * never appears in radius search.
     */
    coordinates: z.tuple([z.number().min(68).max(98), z.number().min(6).max(38)]),
    pinConfirmedByOwner: z.literal(true, {
      message: 'Drag the pin to your gate and confirm it',
    }),
  }),

  3: z
    .array(
      z.object({
        name: z.string().min(1).max(50),
        sport: z.nativeEnum(SportType),
        surface: z.string().max(40).optional(),
        isIndoor: z.boolean().default(false),
        capacity: z.number().int().min(1).max(50).optional(),
        basePricePerHourPaise: z.number().int().min(0).max(2_000_000),
      }),
    )
    .min(1, 'Add at least one court'),

  4: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        openTime: timeOfDay,
        closeTime: timeOfDay,
        isClosed: z.boolean().default(false),
      }),
    )
    .length(7, 'Set hours for all seven days'),

  5: z.array(z.record(z.string(), z.unknown())),

  6: z.object({
    amenities: z.array(z.string().max(40)).max(20),
    cancellationPolicy: z.object({
      freeCancellationHours: z.number().int().min(0).max(168),
      partialRefundPercent: z.number().int().min(0).max(100),
    }),
    bookingMode: z.nativeEnum(BookingMode),
  }),

  7: z.object({
    payout: z.object({
      accountHolderName: z.string().min(2).max(120),
      ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/u).optional(),
      accountNumber: z.string().min(6).max(20).optional(),
      vpa: z.string().max(80).optional(),
      pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/u),
      gstin: z.string().max(20).optional(),
    }),
    agreement: z.object({
      commissionPercent: z.number().min(0).max(50),
      settlementCycle: z.string().max(20).default('weekly'),
      acceptedTerms: z.literal(true, {
        message: 'Accept the partner terms to continue',
      }),
    }),
  }),
} as const;

export async function updatePartnerApplicationStep(
  userId: Types.ObjectId,
  step: number,
  stepData: unknown,
  /** Recorded with the agreement — a T&C acceptance with no IP proves little. */
  acceptedIp?: string,
) {
  const schema = stepSchemas[step as keyof typeof stepSchemas];
  if (!schema) throw new BadRequestError('Invalid wizard step');

  const parsed = schema.safeParse(stepData);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new BadRequestError(
      first ? `${first.path.join('.')}: ${first.message}` : 'That step is incomplete',
    );
  }

  const application = await ArenaApplicationModel.findOne({
    applicantUserId: userId,
    status: ApplicationStatus.IN_PROGRESS,
  });

  if (!application) throw new NotFoundError('Application');

  const data = parsed.data as never;

  if (step === 1) application.venue = data;
  else if (step === 2) application.location = data;
  else if (step === 3) application.courts = data;
  else if (step === 4) application.operatingHours = data;
  else if (step === 5) application.pricingRules = data;
  else if (step === 6) {
    const six = parsed.data as z.infer<(typeof stepSchemas)[6]>;
    application.amenities = six.amenities;
    application.cancellationPolicy = six.cancellationPolicy;
    application.bookingMode = six.bookingMode;
  } else {
    const seven = parsed.data as z.infer<(typeof stepSchemas)[7]>;
    application.payout = seven.payout;
    application.agreement = {
      commissionPercent: seven.agreement.commissionPercent,
      settlementCycle: seven.agreement.settlementCycle,
      acceptedAt: new Date(),
      acceptedIp: acceptedIp ?? 'unknown',
    };
  }

  /**
   * Never moves backwards: editing step 2 after reaching step 6 must not send
   * the owner back through four screens they already finished.
   */
  application.currentStep = Math.max(application.currentStep, step);
  await application.save();
  return application;
}

export async function submitPartnerApplication(userId: Types.ObjectId) {
  const application = await ArenaApplicationModel.findOne({
    applicantUserId: userId,
    status: ApplicationStatus.IN_PROGRESS,
  });

  if (!application) throw new NotFoundError('Application');

  // Basic validation that steps 1 to 7 are filled
  if (application.currentStep < 7) {
    throw new BadRequestError(`Please complete all onboarding wizard steps before submitting (current step: ${application.currentStep})`);
  }

  // 100m duplicate coordinate check
  const coordinates = application.location?.coordinates;
  if (coordinates) {
    const duplicate = await ArenaModel.findOne({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates },
          $maxDistance: 100,
        },
      },
    }).lean();

    if (duplicate) {
      application.possibleDuplicateArenaId = duplicate._id as Types.ObjectId;
    }
  }

  application.status = ApplicationStatus.PENDING_VERIFICATION;
  application.submittedAt = new Date();
  await application.save();
  return application;
}
