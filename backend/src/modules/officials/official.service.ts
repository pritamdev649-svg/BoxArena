import type { Types } from 'mongoose';
import {
  ArenaModel,
  MatchModel,
  OfficialModel,
  OfficialType,
  OfficialVerificationStatus,
  SportType,
  TeamModel,
  UserModel,
  UserRole,
  AccountStatus,
  type IOfficial,
  type IUser,
} from '../../models/index.js';
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/app-error.js';
import { publicId } from '../../shared/utils/ids.js';

/**
 * The officials marketplace (featuredoc/11 §OF1–OF5).
 *
 * The rule the whole feature turns on: **anyone may list themselves and set
 * their own price**, but only a venue's own staff or a platform-verified
 * independent can settle a money match on their scorecard alone. A team's own
 * person can officiate and be paid — their result just still needs both
 * captains.
 */

/**
 * Whether this official's word alone can release escrow.
 *
 * Derived, never stored on the profile, so it cannot drift from the
 * verification status it depends on. It IS snapshotted onto the match at
 * assignment — see `assignOfficial`.
 */
export function canTriggerPayout(official: Pick<IOfficial, 'type' | 'verificationStatus'>): boolean {
  if (official.type === OfficialType.TEAM_ADDED) return false;
  if (official.type === OfficialType.VENUE_STAFF) return true;
  return official.verificationStatus === OfficialVerificationStatus.VERIFIED;
}

/** Adds the derived flag to anything leaving this module. */
function present<T extends Pick<IOfficial, 'type' | 'verificationStatus'>>(official: T) {
  return { ...official, canTriggerPayout: canTriggerPayout(official) };
}

export interface RegisterOfficialInput {
  user: IUser;
  type: OfficialType;
  displayName: string;
  sports: SportType[];
  pricePerMatchPaise: number;
  experienceYears?: number;
  bio?: string;
  /** Required for venue_staff — the venue that vouches for them. */
  arenaPublicId?: string;
}

export async function registerOfficial(input: RegisterOfficialInput) {
  if (input.sports.length === 0) {
    throw new BadRequestError('Pick at least one sport you officiate');
  }

  let linkedArenaId: Types.ObjectId | undefined;

  /**
   * Venue staff carry the venue's trust, so the claim has to come FROM the
   * venue. Letting anyone self-declare as a venue's official would hand out
   * payout-triggering authority to whoever typed the right arena id.
   */
  if (input.type === OfficialType.VENUE_STAFF) {
    if (!input.arenaPublicId) {
      throw new BadRequestError('A venue official must be linked to a venue');
    }
    const arena = await ArenaModel.findOne({ publicId: input.arenaPublicId }).select('_id ownerId staffUserIds').lean();
    if (!arena) throw new NotFoundError('Arena');

    const isOwner = String(arena.ownerId) === String(input.user._id);
    const isStaff = (arena.staffUserIds ?? []).some((id) => String(id) === String(input.user._id));
    if (!isOwner && !isStaff) {
      throw new ForbiddenError('Only the venue owner or their staff can list a venue official');
    }
    linkedArenaId = arena._id as Types.ObjectId;
  }

  const existing = await OfficialModel.findOne({ userId: input.user._id, type: input.type });
  if (existing) {
    throw new ConflictError('CONFLICT', 'You already have an official profile of this type');
  }

  const official = await OfficialModel.create({
    publicId: publicId('ofc'),
    userId: input.user._id,
    type: input.type,
    displayName: input.displayName,
    sports: input.sports,
    pricePerMatchPaise: input.pricePerMatchPaise,
    /** Venue staff inherit the venue's verification; independents earn theirs. */
    verificationStatus:
      input.type === OfficialType.VENUE_STAFF
        ? OfficialVerificationStatus.VERIFIED
        : OfficialVerificationStatus.UNVERIFIED,
    ...(linkedArenaId ? { linkedArenaId } : {}),
    ...(input.experienceYears === undefined ? {} : { experienceYears: input.experienceYears }),
    ...(input.bio === undefined ? {} : { bio: input.bio }),
  });

  return present(official.toObject());
}

export async function listMyOfficialProfiles(user: IUser) {
  const profiles = await OfficialModel.find({ userId: user._id }).lean();
  return profiles.map(present);
}

export interface UpdateOfficialInput {
  displayName?: string;
  sports?: SportType[];
  pricePerMatchPaise?: number;
  experienceYears?: number;
  bio?: string;
  idDocumentUrl?: string;
  isActive?: boolean;
}

export async function updateOwnOfficial(input: {
  user: IUser;
  officialPublicId: string;
  patch: UpdateOfficialInput;
}) {
  const official = await OfficialModel.findOne({ publicId: input.officialPublicId });
  if (!official) throw new NotFoundError('Official');
  if (String(official.userId) !== String(input.user._id)) {
    throw new ForbiddenError('This is not your official profile');
  }

  /** Submitting an ID moves an unverified independent into the ops queue. */
  if (
    input.patch.idDocumentUrl &&
    official.verificationStatus === OfficialVerificationStatus.UNVERIFIED
  ) {
    official.verificationStatus = OfficialVerificationStatus.PENDING;
  }

  Object.assign(
    official,
    Object.fromEntries(Object.entries(input.patch).filter(([, value]) => value !== undefined)),
  );
  await official.save();

  return present(official.toObject());
}

export interface BrowseOfficialsQuery {
  sport?: SportType | undefined;
  arenaPublicId?: string | undefined;
  /** Only those whose scorecard can settle a money match. */
  payoutCapableOnly?: boolean | undefined;
  limit?: number | undefined;
}

/**
 * Browse officials for a venue and slot (§OF3 choice 2).
 *
 * Venue staff for THIS arena sort first — they are on site, and picking them
 * is the default a captain reaches for. Team-added profiles are excluded:
 * those are added directly to a match, never discovered in a marketplace.
 */
export async function browseOfficials(query: BrowseOfficialsQuery) {
  const arena = query.arenaPublicId
    ? await ArenaModel.findOne({ publicId: query.arenaPublicId }).select('_id').lean()
    : null;

  const officials = await OfficialModel.find({
    isActive: true,
    type: { $in: [OfficialType.VENUE_STAFF, OfficialType.INDEPENDENT] },
    ...(query.sport ? { sports: query.sport } : {}),
    ...(query.payoutCapableOnly
      ? {
        $or: [
          { type: OfficialType.VENUE_STAFF },
          { type: OfficialType.INDEPENDENT, verificationStatus: OfficialVerificationStatus.VERIFIED },
        ],
      }
      : {}),
    /** A venue's own staff are only offered at that venue. */
    ...(arena ? { $or: [{ linkedArenaId: arena._id }, { linkedArenaId: { $exists: false } }] } : {}),
  })
    .sort({ 'rating.count': -1, 'rating.average': -1 })
    .limit(Math.min(query.limit ?? 20, 50))
    .lean();

  const atThisArena = (official: (typeof officials)[number]) =>
    arena && String(official.linkedArenaId) === String(arena._id) ? 0 : 1;

  return officials.sort((a, b) => atThisArena(a) - atThisArena(b)).map(present);
}

export async function getOfficial(officialPublicId: string) {
  const official = await OfficialModel.findOne({ publicId: officialPublicId, isActive: true })
    .populate('userId', 'fullName avatarUrl publicId')
    .lean();
  if (!official) throw new NotFoundError('Official');
  return present(official);
}

// ---------------------------------------------------------------------------
// Admin verification
// ---------------------------------------------------------------------------

export async function listPendingVerification() {
  const officials = await OfficialModel.find({
    verificationStatus: OfficialVerificationStatus.PENDING,
  })
    .populate('userId', 'fullName phoneNumber publicId')
    .sort({ createdAt: 1 })
    .lean();
  return officials.map(present);
}

/**
 * Ops decision on an independent official's ID.
 *
 * This is the moment a person gains the power to release someone else's prize
 * money, so it is admin-only and stamped with who did it and when.
 */
export async function setVerificationStatus(input: {
  admin: IUser;
  officialPublicId: string;
  status: OfficialVerificationStatus;
}) {
  if (input.admin.role !== UserRole.ADMIN && input.admin.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenError('Only ops can verify officials');
  }

  const official = await OfficialModel.findOne({ publicId: input.officialPublicId });
  if (!official) throw new NotFoundError('Official');

  official.verificationStatus = input.status;
  official.verifiedByAdminId = input.admin._id as Types.ObjectId;
  official.verifiedAt = new Date();
  await official.save();

  return present(official.toObject());
}

// ---------------------------------------------------------------------------
// Assignment to a match (§OF3)
// ---------------------------------------------------------------------------

async function captainSideFor(
  match: { creatorTeamId: Types.ObjectId; opponentTeamId: Types.ObjectId },
  user: IUser,
) {
  const teams = await TeamModel.find({ _id: { $in: [match.creatorTeamId, match.opponentTeamId] } })
    .select('_id captainId')
    .lean();

  const creatorTeam = teams.find((team) => String(team._id) === String(match.creatorTeamId));
  const opponentTeam = teams.find((team) => String(team._id) === String(match.opponentTeamId));

  if (creatorTeam && String(creatorTeam.captainId) === String(user._id)) return 'creator' as const;
  if (opponentTeam && String(opponentTeam.captainId) === String(user._id)) return 'opponent' as const;
  return null;
}

/**
 * A captain proposes an official; the other captain confirms.
 *
 * Mutual consent is the whole design — a unilateral pick would let one side
 * choose who validates the result they are about to be paid on. Proposing a
 * DIFFERENT official resets both confirmations rather than silently keeping
 * the other captain's agreement to someone else.
 */
export async function proposeOfficial(input: {
  user: IUser;
  matchPublicId: string;
  officialPublicId: string;
}) {
  const match = await MatchModel.findOne({ publicId: input.matchPublicId });
  if (!match) throw new NotFoundError('Match');

  const side = await captainSideFor(match, input.user);
  if (!side) throw new ForbiddenError('Only a team captain can choose the official');

  if (match.startedAt) {
    throw new ConflictError('CONFLICT', 'The match has already started');
  }

  const official = await OfficialModel.findOne({ publicId: input.officialPublicId, isActive: true }).lean();
  if (!official) throw new NotFoundError('Official');
  if (!official.sports.includes(match.sport)) {
    throw new BadRequestError('That official does not cover this sport');
  }

  const isSameOfficial = String(match.officialId) === String(official._id);
  match.officialId = official._id as Types.ObjectId;
  match.officialCanTriggerPayout = canTriggerPayout(official);

  if (!isSameOfficial) {
    match.officialConfirmedByCreator = false;
    match.officialConfirmedByOpponent = false;
  }
  if (side === 'creator') match.officialConfirmedByCreator = true;
  else match.officialConfirmedByOpponent = true;

  await match.save();
  return assignmentState(match);
}

export async function confirmOfficial(input: { user: IUser; matchPublicId: string }) {
  const match = await MatchModel.findOne({ publicId: input.matchPublicId });
  if (!match) throw new NotFoundError('Match');
  if (!match.officialId) throw new BadRequestError('No official has been proposed yet');

  const side = await captainSideFor(match, input.user);
  if (!side) throw new ForbiddenError('Only a team captain can confirm the official');

  if (side === 'creator') match.officialConfirmedByCreator = true;
  else match.officialConfirmedByOpponent = true;

  await match.save();
  return assignmentState(match);
}

function assignmentState(match: {
  officialId?: Types.ObjectId | undefined;
  officialCanTriggerPayout?: boolean | undefined;
  officialConfirmedByCreator: boolean;
  officialConfirmedByOpponent: boolean;
}) {
  return {
    officialId: match.officialId ? String(match.officialId) : null,
    canTriggerPayout: match.officialCanTriggerPayout ?? false,
    confirmedByCreator: match.officialConfirmedByCreator,
    confirmedByOpponent: match.officialConfirmedByOpponent,
    /** Locked only when BOTH captains have agreed (§OF3). */
    locked: match.officialConfirmedByCreator && match.officialConfirmedByOpponent,
  };
}

/** The matches this official has been assigned — their day's work. */
export async function listAssignedMatches(user: IUser) {
  const profiles = await OfficialModel.find({ userId: user._id }).select('_id').lean();
  if (profiles.length === 0) return [];

  return MatchModel.find({ officialId: { $in: profiles.map((p) => p._id) } })
    .select('publicId sport format scheduledAt status arenaId bestOf officialConfirmedByCreator officialConfirmedByOpponent')
    .sort({ scheduledAt: 1 })
    .limit(50)
    .lean();
}

/** Used by the registration route to reject a user who is suspended. */
export async function assertActiveUser(user: IUser): Promise<void> {
  const fresh = await UserModel.findById(user._id).select('status').lean();
  if (fresh && fresh.status !== AccountStatus.ACTIVE) {
    throw new ForbiddenError('Your account cannot register as an official');
  }
}
