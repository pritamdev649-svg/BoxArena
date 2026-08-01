import mongoose, { type Types } from 'mongoose';
import { connectDatabase, disconnectDatabase, withTransaction } from '../shared/config/db.js';
import { logger } from '../shared/config/logger.js';
import {
  ApplicationStatus,
  MatchFormat,
  ArenaApplicationModel,
  ArenaModel,
  BookingModel,
  BookingSource,
  BookingStatus,
  CourtModel,
  PlayerSportStatsModel,
  SlotModel,
  SlotStatus,
  TeamModel,
  TeamMemberRole,
  TransactionType,
  UserModel,
  UserRole,
  WalletBucket,
  type IUser,
} from '../models/index.js';
import { checkInCode, publicId, referralCode } from '../shared/utils/ids.js';
import { istDateTimeToUtc, istDayOfWeek, toLocalDate } from '../shared/utils/datetime.js';
import { applyLedgerEntry } from '../modules/wallet/wallet.service.js';
import {
  OPERATING_HOURS,
  SEED_APPLICATIONS,
  SEED_ARENAS,
  SEED_PLAYERS,
  SEED_TEAMS,
  type SeedArenaDef,
} from './seed-data.js';

/**
 * Populates every collection the partner and admin panels read from.
 *
 * Idempotent: re-running upserts rather than duplicating, so it is safe to run
 * against a database that already has data. Wallets are funded THROUGH the
 * ledger so invariant I1 holds from the first row — seeding a balance directly
 * would start the database in a state the reconciliation job flags as drift.
 */

async function upsertUser(input: {
  phone: string;
  fullName: string;
  role: UserRole;
  areaName?: string;
}): Promise<IUser> {
  const user = await UserModel.findOneAndUpdate(
    { phoneNumber: input.phone },
    {
      $setOnInsert: {
        publicId: publicId('usr'),
        phoneNumber: input.phone,
        phoneVerified: true,
        fullName: input.fullName,
        role: input.role,
        referralCode: referralCode(),
        ...(input.areaName === undefined ? {} : { homeAreaName: input.areaName }),
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!user) throw new Error(`Failed to upsert user ${input.phone}`);
  return user;
}

/** Credits a bucket through the ledger so cached balance == ledger sum. */
async function fundWallet(
  user: IUser,
  bucket: WalletBucket,
  amountPaise: number,
  type: TransactionType,
): Promise<void> {
  if (amountPaise <= 0) return;

  const already = await UserModel.findById(user._id).lean();
  if (!already) return;
  const current = already.wallet[
    bucket === WalletBucket.DEPOSIT
      ? 'depositPaise'
      : bucket === WalletBucket.WINNINGS
        ? 'winningsPaise'
        : 'bonusPaise'
  ];
  if (current > 0) return; // already funded on a previous run

  await withTransaction(async (session) => {
    await applyLedgerEntry(
      {
        userId: user._id as Types.ObjectId,
        bucket,
        amountPaise,
        type,
        description: 'Seed balance',
        idempotencyKey: `seed:${user.publicId}:${bucket}`,
      },
      session,
    );
  });
}

async function seedArena(definition: SeedArenaDef) {
  const owner = await upsertUser({
    phone: definition.ownerPhone,
    fullName: definition.ownerName,
    role: UserRole.ARENA_OWNER,
    areaName: definition.areaName,
  });

  const arena = await ArenaModel.findOneAndUpdate(
    { slug: definition.slug },
    {
      $setOnInsert: {
        publicId: publicId('arn'),
        name: definition.name,
        slug: definition.slug,
        ownerId: owner._id,
        address: {
          line1: definition.line1,
          areaName: definition.areaName,
          city: 'Lucknow',
          state: 'Uttar Pradesh',
          pincode: definition.pincode,
        },
        location: { type: 'Point', coordinates: definition.coordinates },
        sportsSupported: definition.sports,
        amenities: definition.amenities,
        operatingHours: OPERATING_HOURS,
        contactPhone: definition.ownerPhone,
        rating: definition.rating,
        isVerified: definition.isVerified,
        bookingMode: definition.bookingMode,
      },
    },
    { upsert: true, returnDocument: 'after' },
  );
  if (!arena) throw new Error(`Failed to upsert arena ${definition.slug}`);

  for (const courtDef of definition.courts) {
    const court = await CourtModel.findOneAndUpdate(
      { arenaId: arena._id, name: courtDef.name },
      {
        $setOnInsert: {
          arenaId: arena._id,
          name: courtDef.name,
          sport: courtDef.sport,
          surface: courtDef.surface,
          isIndoor: courtDef.isIndoor,
          basePricePerHourPaise: courtDef.pricePaise,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );
    if (court) {
      await materialiseSlots(
        arena._id as Types.ObjectId,
        court._id as Types.ObjectId,
        courtDef.sport,
        courtDef.pricePaise,
      );
    }
  }

  return arena;
}

/** Rolling 14-day window of hourly slots, generated from operating hours. */
async function materialiseSlots(
  arenaId: Types.ObjectId,
  courtId: Types.ObjectId,
  sport: SeedArenaDef['courts'][number]['sport'],
  pricePaise: number,
): Promise<void> {
  const docs: Record<string, unknown>[] = [];

  for (let dayOffset = 0; dayOffset < 14; dayOffset += 1) {
    const day = new Date(Date.now() + dayOffset * 86_400_000);
    const localDate = toLocalDate(day);
    const hours = OPERATING_HOURS[istDayOfWeek(day)];
    if (!hours || hours.isClosed) continue;

    const openHour = Number(hours.openTime.split(':')[0]);
    const closeHour = Number(hours.closeTime.split(':')[0]);

    for (let hour = openHour; hour < closeHour; hour += 1) {
      const startAt = istDateTimeToUtc(localDate, `${String(hour).padStart(2, '0')}:00`);
      if (startAt.getTime() < Date.now()) continue;

      docs.push({
        arenaId,
        courtId,
        sport,
        startAt,
        endAt: new Date(startAt.getTime() + 3_600_000),
        localDate,
        pricePaise,
      });
    }
  }

  if (docs.length > 0) {
    /** ordered:false so slots that already exist don't abort the batch. */
    await SlotModel.insertMany(docs, { ordered: false }).catch(() => undefined);
  }
}

/**
 * Books a handful of real slots so the partner dashboard has something to
 * manage. Mixes app bookings with desk-entered walk-ins, because the
 * online/offline split is what an owner actually looks at (§115).
 */
async function seedBookings(): Promise<number> {
  const players = await UserModel.find({ role: UserRole.PLAYER }).limit(6);
  const arenas = await ArenaModel.find({ isVerified: true });
  let created = 0;

  for (const [index, arena] of arenas.entries()) {
    const open = await SlotModel.find({
      arenaId: arena._id,
      status: SlotStatus.AVAILABLE,
    })
      .sort({ startAt: 1 })
      .limit(4);

    for (const [slotIndex, slot] of open.entries()) {
      const booker = players[(index + slotIndex) % players.length];
      if (!booker) continue;

      const isWalkIn = slotIndex % 3 === 2;
      const idempotencyKey = `seed:booking:${String(slot._id)}`;

      const exists = await BookingModel.findOne({ idempotencyKey });
      if (exists) continue;

      const [booking] = await BookingModel.create([
        {
          publicId: publicId('bkg'),
          arenaId: arena._id,
          courtId: slot.courtId,
          slotIds: [slot._id],
          bookerId: booker._id,
          sport: slot.sport,
          startAt: slot.startAt,
          endAt: slot.endAt,
          subtotalPaise: slot.pricePaise,
          totalPaise: slot.pricePaise,
          paidFromWalletPaise: isWalkIn ? 0 : slot.pricePaise,
          status: BookingStatus.CONFIRMED,
          source: isWalkIn ? BookingSource.OFFLINE_DESK : BookingSource.APP,
          balanceDuePaise: isWalkIn ? slot.pricePaise : 0,
          idempotencyKey,
          checkInCode: checkInCode(),
        },
      ]);

      if (booking) {
        await SlotModel.updateOne(
          { _id: slot._id },
          { $set: { status: SlotStatus.BOOKED, bookingId: booking._id } },
        );
        created += 1;
      }
    }
  }

  return created;
}

/** Applications sitting in the admin approval queue. */
async function seedApplications(): Promise<number> {
  let created = 0;

  for (const definition of SEED_APPLICATIONS) {
    const exists = await ArenaApplicationModel.findOne({
      'lead.phoneNumber': definition.phoneNumber,
    });
    if (exists) continue;

    await ArenaApplicationModel.create({
      publicId: publicId('app'),
      status: definition.complete
        ? ApplicationStatus.PENDING_VERIFICATION
        : ApplicationStatus.IN_PROGRESS,
      currentStep: definition.complete ? 7 : 3,
      lead: {
        ownerName: definition.ownerName,
        phoneNumber: definition.phoneNumber,
        phoneVerified: true,
        venueName: definition.venueName,
        areaName: definition.areaName,
        sports: definition.sports,
        courtCount: definition.courtCount,
        source: definition.source,
      },
      ...(definition.complete
        ? {
            venue: {
              name: definition.venueName,
              contactPhone: definition.phoneNumber,
              images: [],
            },
            location: {
              address: { areaName: definition.areaName, city: 'Lucknow' },
              coordinates: [80.94 + Math.random() * 0.1, 26.84 + Math.random() * 0.06],
              pinConfirmedByOwner: true,
            },
            submittedAt: new Date(),
          }
        : {}),
    });
    created += 1;
  }

  return created;
}

async function seedTeamsAndStats(): Promise<void> {
  for (const definition of SEED_TEAMS) {
    const captain = await UserModel.findOne({ phoneNumber: definition.captainPhone });
    if (!captain) continue;

    const members = await UserModel.find({ phoneNumber: { $in: definition.memberPhones } });
    const slug = definition.name.toLowerCase().replace(/[^a-z0-9]+/gu, '-');

    await TeamModel.findOneAndUpdate(
      { slug, sport: definition.sport },
      {
        $setOnInsert: {
          publicId: publicId('tm'),
          name: definition.name,
          slug,
          captainId: captain._id,
          sport: definition.sport,
          format: definition.format,
          members: members.map((member) => ({
            userId: member._id,
            role: String(member._id) === String(captain._id)
              ? TeamMemberRole.CAPTAIN
              : TeamMemberRole.MEMBER,
            joinedAt: new Date(),
            isActive: true,
          })),
          homeAreaName: definition.areaName,
          eloRating: definition.eloRating,
        },
      },
      { upsert: true },
    );
  }

  for (const definition of SEED_PLAYERS) {
    const user = await UserModel.findOne({ phoneNumber: definition.phone });
    if (!user) continue;

    await PlayerSportStatsModel.findOneAndUpdate(
      { userId: user._id, sport: definition.primarySport, format: MatchFormat.SINGLES },
      {
        $setOnInsert: {
          userId: user._id,
          sport: definition.primarySport,
          format: MatchFormat.SINGLES,
          eloRating: definition.eloRating,
          peakEloRating: definition.eloRating,
          areaName: definition.areaName,
        },
      },
      { upsert: true },
    );
  }
}

async function seed(): Promise<void> {
  await connectDatabase();

  await upsertUser({
    phone: process.env['SEED_SUPER_ADMIN_PHONE'] ?? '+919999999999',
    fullName: 'BoxArena Ops',
    role: UserRole.SUPER_ADMIN,
  });

  for (const definition of SEED_ARENAS) {
    const arena = await seedArena(definition);
    /** Desk staff, so the partner panel has a staff list to manage (§4.10). */
    const staff = await upsertUser({
      phone: definition.ownerPhone.replace('+9198100', '+9198110'),
      fullName: `${definition.name} Front Desk`,
      role: UserRole.ARENA_STAFF,
    });
    await UserModel.updateOne({ _id: staff._id }, { $set: { employedAtArenaId: arena._id } });
    await ArenaModel.updateOne({ _id: arena._id }, { $addToSet: { staffUserIds: staff._id } });
  }

  for (const definition of SEED_PLAYERS) {
    const user = await upsertUser({
      phone: definition.phone,
      fullName: definition.fullName,
      role: UserRole.PLAYER,
      areaName: definition.areaName,
    });
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { skillLevel: definition.skillLevel, primarySport: definition.primarySport } },
    );
    await fundWallet(user, WalletBucket.DEPOSIT, definition.depositPaise, TransactionType.DEPOSIT);
    await fundWallet(user, WalletBucket.WINNINGS, definition.winningsPaise, TransactionType.PRIZE_PAYOUT);
    await fundWallet(user, WalletBucket.BONUS, definition.bonusPaise, TransactionType.BONUS_CREDIT);
  }

  await seedTeamsAndStats();
  const bookings = await seedBookings();
  const applications = await seedApplications();

  logger.info(
    {
      arenas: await ArenaModel.countDocuments(),
      courts: await CourtModel.countDocuments(),
      slots: await SlotModel.countDocuments(),
      users: await UserModel.countDocuments(),
      teams: await TeamModel.countDocuments(),
      bookings,
      applications,
    },
    'Seed complete',
  );

  await disconnectDatabase();
}

seed().catch((err: unknown) => {
  logger.error({ err }, 'Seed failed');
  void mongoose.disconnect().finally(() => process.exit(1));
});
