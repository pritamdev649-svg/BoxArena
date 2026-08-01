import mongoose, { type Types } from 'mongoose';
import {
  AccountStatus,
  ApplicationStatus,
  ArenaApplicationModel,
  ArenaModel,
  AuditLogModel,
  BookingModel,
  CourtModel,
  DisputeModel,
  PricingRuleModel,
  SportType,
  UserModel,
  UserRole,
  MatchModel,
  MatchStatus,
  ChallengeModel,
  ChallengeStatus,
  WithdrawalRequestModel,
  SettlementModel,
  AppConfigModel,
  TransactionModel,
  TransactionType,
  WalletBucket,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { BadRequestError, NotFoundError, ForbiddenError } from '../../shared/errors/app-error.js';
import { publicId, referralCode } from '../../shared/utils/ids.js';
import { materialiseArenaSlots as materialiseArenaSlotsForArena } from '../arenas/slot.service.js';
import { parseApplicationPricingRules } from '../arenas/pricing.validators.js';
import { refundEscrow } from '../wallet/wallet.service.js';
import { settleVerified } from '../matches/match.service.js';

/**
 * Ops admin. Every mutation here writes an AuditLog — when a dispute later
 * involves a venue you must be able to say who approved it and on what
 * evidence (arena_onboarding.md §5, compliance.md §1).
 */

async function audit(input: {
  actor: IUser;
  action: string;
  targetType: string;
  targetId?: Types.ObjectId;
  before?: unknown;
  after?: unknown;
  reason?: string;
}): Promise<void> {
  await AuditLogModel.create({
    actorUserId: input.actor._id,
    actorRole: input.actor.role,
    action: input.action,
    targetType: input.targetType,
    ...(input.targetId === undefined ? {} : { targetId: input.targetId }),
    ...(input.before === undefined ? {} : { before: input.before }),
    ...(input.after === undefined ? {} : { after: input.after }),
    ...(input.reason === undefined ? {} : { reason: input.reason }),
  });
}

export async function listApplications(status?: ApplicationStatus) {
  return ArenaApplicationModel.find(status ? { status } : {})
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}

export async function getApplication(applicationPublicId: string) {
  const application = await ArenaApplicationModel.findOne({ publicId: applicationPublicId }).lean();
  if (!application) throw new NotFoundError('Application');

  /**
   * Duplicate check: two people applying for the same turf (§123). Flags
   * anything within 100m so ops can ask who actually owns it.
   */
  const coordinates = application.location?.coordinates;
  const nearby = coordinates
    ? await ArenaModel.find({
        location: {
          $near: {
            $geometry: { type: 'Point', coordinates },
            $maxDistance: 100,
          },
        },
      })
        .select('publicId name address.areaName')
        .limit(5)
        .lean()
    : [];

  return { ...application, possibleDuplicates: nearby };
}

/** Ticks items on the ops verification checklist. */
export async function updateVerification(input: {
  actor: IUser;
  applicationPublicId: string;
  checklist: Record<string, boolean>;
  notes?: string;
}) {
  const application = await ArenaApplicationModel.findOne({
    publicId: input.applicationPublicId,
  });
  if (!application) throw new NotFoundError('Application');

  Object.assign(application.verification, input.checklist);
  if (input.notes !== undefined) application.verification.notes = input.notes;
  await application.save();

  await audit({
    actor: input.actor,
    action: 'application.verify',
    targetType: 'ArenaApplication',
    targetId: application._id as Types.ObjectId,
    after: input.checklist,
  });

  return application;
}

const REQUIRED_CHECKS = [
  'phoneVerifiedByOps',
  'pinMatchesSatellite',
  'photosAuthentic',
  'courtCountVerified',
  'ownershipDocSeen',
  'bankNameMatches',
  'pricingSane',
] as const;

/**
 * Approval is the gate. Creating the Arena, its Courts and its first 30 days
 * of slots happens in ONE transaction — a half-created venue that appears in
 * search but cannot be booked is worse than no venue.
 */
export async function approveApplication(input: {
  actor: IUser;
  applicationPublicId: string;
  commissionPercent?: number;
}) {
  const application = await ArenaApplicationModel.findOne({
    publicId: input.applicationPublicId,
  });
  if (!application) throw new NotFoundError('Application');

  if (application.status === ApplicationStatus.APPROVED) {
    throw new BadRequestError('This application is already approved');
  }

  /** Nothing goes live on trust — every box must be ticked first (§5). */
  const missing = REQUIRED_CHECKS.filter((check) => !application.verification[check]);
  if (missing.length > 0) {
    throw new BadRequestError(
      `Complete the verification checklist first. Outstanding: ${missing.join(', ')}`,
    );
  }

  const coordinates = application.location?.coordinates;
  if (!coordinates) throw new BadRequestError('The venue location pin is missing');

  return withTransaction(async (session) => {
    const owner = await UserModel.findOneAndUpdate(
      { phoneNumber: application.lead.phoneNumber },
      {
        $setOnInsert: {
          publicId: publicId('usr'),
          phoneNumber: application.lead.phoneNumber,
          phoneVerified: true,
          fullName: application.lead.ownerName,
          referralCode: referralCode(),
        },
        $set: { role: UserRole.ARENA_OWNER, status: AccountStatus.ACTIVE },
      },
      { upsert: true, returnDocument: 'after', session },
    );
    if (!owner) throw new Error('Failed to create the owner account');

    // Check if the Arena already exists for this application
    let arena = await ArenaModel.findOne({ applicationId: application._id }).session(session);
    let courtCount = 0;
    let ruleDocsCount = 0;

    if (arena) {
      // Reactivate existing Arena
      arena.isActive = true;
      arena.isVerified = true;
      if (input.commissionPercent !== undefined) {
        arena.commissionPercent = input.commissionPercent;
      }
      await arena.save({ session });

      courtCount = await CourtModel.countDocuments({ arenaId: arena._id }).session(session);
      ruleDocsCount = await PricingRuleModel.countDocuments({ arenaId: arena._id }).session(session);
    } else {
      // Create new Arena
      const slug = application.lead.venueName
        .toLowerCase()
        .replace(/[^a-z0-9]+/gu, '-')
        .replace(/(^-|-$)/gu, '');

      const [newArena] = await ArenaModel.create(
        [
          {
            publicId: publicId('arn'),
            name: application.lead.venueName,
            slug: `${slug}-${application.lead.areaName.toLowerCase().replace(/\s+/gu, '-')}`,
            ownerId: owner._id,
            address: {
              line1: application.lead.venueName,
              areaName: application.lead.areaName,
              city: 'Lucknow',
              state: 'Uttar Pradesh',
              pincode: '226010',
            },
            location: { type: 'Point', coordinates },
            sportsSupported: application.lead.sports,
            amenities: application.amenities ?? [],
            operatingHours:
              application.operatingHours && application.operatingHours.length > 0
                ? application.operatingHours
                : defaultHours(),
            contactPhone: application.lead.phoneNumber,
            isVerified: true,
            isActive: true,
            applicationId: application._id,
            ...(input.commissionPercent === undefined
              ? {}
              : { commissionPercent: input.commissionPercent }),
          },
        ],
        { session },
      );
      if (!newArena) throw new Error('Arena creation returned nothing');
      arena = newArena;

      const courtDefs =
        application.courts && application.courts.length > 0
          ? application.courts
          : defaultCourts(application.lead.sports, application.lead.courtCount);

      const courtDocs = courtDefs.map((court) => ({
        arenaId: arena!._id as Types.ObjectId,
        name: String(court.name),
        sport: court.sport as SportType,
        isIndoor: court.isIndoor ?? true,
        basePricePerHourPaise: Number(court.basePricePerHourPaise),
      }));
      const courts = await CourtModel.insertMany(courtDocs, { session });
      courtCount = courts.length;

      const courtIdByName = new Map(courts.map((court) => [court.name, court._id as Types.ObjectId]));
      const ruleDocs = parseApplicationPricingRules(application.pricingRules).map((rule) => ({
        arenaId: arena!._id as Types.ObjectId,
        ...(rule.courtId && courtIdByName.has(rule.courtId)
          ? { courtId: courtIdByName.get(rule.courtId) }
          : {}),
        appliesTo: rule.appliesTo,
        daysOfWeek: rule.daysOfWeek ?? [],
        ...(rule.specificDate ? { specificDate: rule.specificDate } : {}),
        startTime: rule.startTime,
        endTime: rule.endTime,
        pricePerHourPaise: rule.pricePerHourPaise,
        priority: rule.priority,
        ...(rule.validFrom ? { validFrom: rule.validFrom } : {}),
        ...(rule.validTo ? { validTo: rule.validTo } : {}),
      }));
      if (ruleDocs.length > 0) {
        await PricingRuleModel.insertMany(ruleDocs, { session });
        ruleDocsCount = ruleDocs.length;
      }
    }

    application.status = ApplicationStatus.APPROVED;
    application.approvedArenaId = arena._id as Types.ObjectId;
    application.reviewedByAdminId = input.actor._id as Types.ObjectId;
    await application.save({ session });

    await audit({
      actor: input.actor,
      action: 'application.approve',
      targetType: 'ArenaApplication',
      targetId: application._id as Types.ObjectId,
      after: { arenaId: String(arena._id), courtCount, pricingRulesCount: ruleDocsCount },
    });

    return { arena, courtCount };
  });
}

export async function rejectApplication(input: {
  actor: IUser;
  applicationPublicId: string;
  reason: string;
}) {
  const application = await ArenaApplicationModel.findOne({
    publicId: input.applicationPublicId,
  });
  if (!application) throw new NotFoundError('Application');

  const previouslyApproved = application.status === ApplicationStatus.APPROVED;

  application.status = ApplicationStatus.REJECTED;
  application.rejectionReason = input.reason;
  application.reviewedByAdminId = input.actor._id as Types.ObjectId;
  await application.save();

  if (previouslyApproved) {
    // Deactivate the associated arena
    await ArenaModel.updateMany(
      { applicationId: application._id },
      { $set: { isActive: false, isVerified: false } }
    );
    // Suspend the owner user
    if (application.applicantUserId) {
      await UserModel.updateOne(
        { _id: application.applicantUserId },
        { $set: { status: AccountStatus.SUSPENDED } }
      );
    }
  }

  await audit({
    actor: input.actor,
    action: 'application.reject',
    targetType: 'ArenaApplication',
    targetId: application._id as Types.ObjectId,
    reason: input.reason,
  });

  // Notify the owner in real-time via WebSocket
  if (application.applicantUserId) {
    const { sendToUserWithAck } = await import('../../shared/services/socket.js');
    void sendToUserWithAck(application.applicantUserId.toString(), 'application.rejected', {
      applicationPublicId: application.publicId,
      reason: input.reason,
    });
  }

  return application;
}

/**
 * Materialises the first 30 days once a venue is live.
 *
 * The implementation lives in the arenas module — the same routine runs daily
 * from the worker so the window keeps rolling. Kept here as a named re-export
 * so the approve route reads as one flow.
 */
export async function materialiseArenaSlots(arenaId: Types.ObjectId): Promise<number> {
  return materialiseArenaSlotsForArena({ arenaId });
}

function defaultHours() {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openTime: '06:00',
    closeTime: '23:00',
    isClosed: false,
  }));
}

interface CourtDraft {
  name: string;
  sport: SportType;
  isIndoor: boolean;
  basePricePerHourPaise: number;
}

function defaultCourts(sports: SportType[], count: number): CourtDraft[] {
  const sport = sports[0] ?? SportType.BADMINTON;
  return Array.from({ length: Math.max(count, 1) }, (_, index) => ({
    name: `Court ${String(index + 1)}`,
    sport,
    isIndoor: true,
    basePricePerHourPaise: 40_000,
  }));
}

export async function getAdminOverview() {
  const [pendingApplications, openDisputes, arenas, users, todayBookings] = await Promise.all([
    ArenaApplicationModel.countDocuments({ status: ApplicationStatus.PENDING_VERIFICATION }),
    DisputeModel.countDocuments({ status: { $in: ['open', 'under_review'] } }),
    ArenaModel.countDocuments({ isActive: true }),
    UserModel.countDocuments({ role: UserRole.PLAYER }),
    BookingModel.countDocuments({ startAt: { $gte: new Date() } }),
  ]);

  return { pendingApplications, openDisputes, arenas, users, todayBookings };
}

export async function listDisputes(status?: string) {
  const filter: Record<string, unknown> = {};
  if (status) filter['status'] = status;
  return DisputeModel.find(filter)
    .sort({ slaDueAt: 1 })
    .limit(100)
    .populate('matchId')
    .lean();
}

export async function suspendUser(input: { actor: IUser; userPublicId: string; reason: string }) {
  const user = await UserModel.findOne({ publicId: input.userPublicId });
  if (!user) throw new NotFoundError('User');

  const before = user.status;
  user.status = AccountStatus.SUSPENDED;
  await user.save();

  await audit({
    actor: input.actor,
    action: 'user.suspend',
    targetType: 'User',
    targetId: user._id as Types.ObjectId,
    before: { status: before },
    after: { status: user.status },
    reason: input.reason,
  });

  return user;
}

export async function getDispute(disputeId: string) {
  let dispute = null;
  if (mongoose.Types.ObjectId.isValid(disputeId)) {
    dispute = await DisputeModel.findById(disputeId)
      .populate({ path: 'matchId', populate: { path: 'challengeId' } })
      .lean();
  }
  if (!dispute) {
    const match = await MatchModel.findOne({ publicId: disputeId }).lean();
    if (match) {
      dispute = await DisputeModel.findOne({ matchId: match._id })
        .populate({ path: 'matchId', populate: { path: 'challengeId' } })
        .lean();
    }
  }
  if (!dispute) throw new NotFoundError('Dispute');
  return dispute;
}

export async function assignDispute(input: { actor: IUser; disputeId: string }) {
  let dispute = null;
  if (mongoose.Types.ObjectId.isValid(input.disputeId)) {
    dispute = await DisputeModel.findById(input.disputeId);
  }
  if (!dispute) {
    const match = await MatchModel.findOne({ publicId: input.disputeId });
    if (match) {
      dispute = await DisputeModel.findOne({ matchId: match._id });
    }
  }
  if (!dispute) throw new NotFoundError('Dispute');

  dispute.status = 'under_review';
  dispute.assignedAdminId = input.actor._id as Types.ObjectId;
  await dispute.save();

  await audit({
    actor: input.actor,
    action: 'dispute.assign',
    targetType: 'Dispute',
    targetId: dispute._id as Types.ObjectId,
    after: { status: dispute.status, assignedAdminId: String(input.actor._id) },
  });

  return dispute;
}

export async function resolveDispute(
  actor: IUser,
  disputeId: string,
  resolution: {
    winnerTeamId?: string;
    isVoided: boolean;
    finalScore?: any;
    adminNote: string;
  }
) {
  return withTransaction(async (session) => {
    let dispute = null;
    if (mongoose.Types.ObjectId.isValid(disputeId)) {
      dispute = await DisputeModel.findById(disputeId).session(session);
    }
    if (!dispute) {
      const matchObj = await MatchModel.findOne({ publicId: disputeId }).session(session);
      if (matchObj) {
        dispute = await DisputeModel.findOne({ matchId: matchObj._id }).session(session);
      }
    }
    if (!dispute) throw new NotFoundError('Dispute');

    const match = await MatchModel.findById(dispute.matchId).session(session);
    if (!match) throw new NotFoundError('Match');

    const challenge = await ChallengeModel.findById(match.challengeId).session(session);
    if (!challenge) throw new NotFoundError('Challenge');

    if (resolution.isVoided) {
      // Refund escrow to both sides
      if (challenge.entryFeePaise > 0) {
        await refundEscrow({
          userId: challenge.creatorUserId,
          challengeId: challenge._id as Types.ObjectId,
          holdIdempotencyKey: `escrow:${challenge.publicId}:creator`,
          description: 'Match voided by admin — entry fee refunded',
        }, session);
        
        if (challenge.opponentUserId) {
          await refundEscrow({
            userId: challenge.opponentUserId,
            challengeId: challenge._id as Types.ObjectId,
            holdIdempotencyKey: `escrow:${challenge.publicId}:opponent`,
            description: 'Match voided by admin — entry fee refunded',
          }, session);
        }
      }
      match.status = MatchStatus.VOIDED;
      challenge.status = ChallengeStatus.CANCELLED;
      await challenge.save({ session });
      await match.save({ session });
    } else {
      // Settle score and payout to winner
      const side = resolution.winnerTeamId === String(match.creatorTeamId) ? 'creator' : 'opponent';
      
      const finalScore = resolution.finalScore || match.submissions[0]?.score;
      if (!finalScore) throw new BadRequestError('Final score is required to resolve dispute');

      await settleVerified(match, finalScore, side, false, session);
      match.status = MatchStatus.ADMIN_RESOLVED;
      await match.save({ session });
    }

    dispute.status = 'resolved';
    dispute.resolution = {
      resolvedByAdminId: actor._id as Types.ObjectId,
      winnerTeamId: resolution.winnerTeamId ? new mongoose.Types.ObjectId(resolution.winnerTeamId) as any : undefined,
      isVoided: resolution.isVoided,
      finalScore: resolution.finalScore,
      adminNote: resolution.adminNote,
      resolvedAt: new Date(),
    };
    await dispute.save({ session });

    await audit({
      actor,
      action: 'dispute.resolve',
      targetType: 'Dispute',
      targetId: dispute._id as Types.ObjectId,
      after: dispute.resolution,
      reason: resolution.adminNote,
    });

    return dispute;
  });
}

export async function listUsers(search?: string) {
  const filter: Record<string, any> = {};
  if (search) {
    filter['$or'] = [
      { fullName: { $regex: search, $options: 'i' } },
      { phoneNumber: { $regex: search } },
    ];
  }
  return UserModel.find(filter).limit(100).lean();
}

export async function adjustWallet(
  actor: IUser,
  userPublicId: string,
  amountPaise: number,
  reason: string
) {
  if (actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenError('Only super_admin can manually adjust wallet balances');
  }

  const user = await UserModel.findOne({ publicId: userPublicId });
  if (!user) throw new NotFoundError('User');

  return withTransaction(async (session) => {
    const beforeWallet = { ...user.wallet };

    if (amountPaise > 0) {
      user.wallet.depositPaise += amountPaise;
      await user.save({ session });

      await TransactionModel.create([{
        publicId: publicId('txn'),
        userId: user._id,
        amountPaise,
        type: TransactionType.ADMIN_ADJUSTMENT,
        bucket: WalletBucket.DEPOSIT,
        balanceAfterPaise: user.wallet.depositPaise,
        description: `Admin manual adjustment: ${reason}`,
        idempotencyKey: `adjust:credit:${user.publicId}:${Date.now()}:${Math.random()}`,
      }], { session });
    } else if (amountPaise < 0) {
      const debit = Math.abs(amountPaise);
      const totalSpendable = user.wallet.depositPaise + user.wallet.winningsPaise + user.wallet.bonusPaise;
      if (totalSpendable < debit) {
        throw new BadRequestError('User does not have sufficient spendable balance to deduct');
      }

      // Deduct systematically: deposit -> winnings -> bonus
      let remaining = debit;
      if (user.wallet.depositPaise > 0 && remaining > 0) {
        const deduct = Math.min(user.wallet.depositPaise, remaining);
        user.wallet.depositPaise -= deduct;
        remaining -= deduct;
        await TransactionModel.create([{
          publicId: publicId('txn'),
          userId: user._id,
          type: TransactionType.ADMIN_ADJUSTMENT,
          amountPaise: -deduct,
          bucket: WalletBucket.DEPOSIT,
          balanceAfterPaise: user.wallet.depositPaise,
          description: `Admin manual deduction: ${reason}`,
          idempotencyKey: `adjust:deduct:${user.publicId}:deposit:${Date.now()}:${Math.random()}`,
        }], { session });
      }

      if (user.wallet.winningsPaise > 0 && remaining > 0) {
        const deduct = Math.min(user.wallet.winningsPaise, remaining);
        user.wallet.winningsPaise -= deduct;
        remaining -= deduct;
        await TransactionModel.create([{
          publicId: publicId('txn'),
          userId: user._id,
          type: TransactionType.ADMIN_ADJUSTMENT,
          amountPaise: -deduct,
          bucket: WalletBucket.WINNINGS,
          balanceAfterPaise: user.wallet.winningsPaise,
          description: `Admin manual deduction: ${reason}`,
          idempotencyKey: `adjust:deduct:${user.publicId}:winnings:${Date.now()}:${Math.random()}`,
        }], { session });
      }

      if (user.wallet.bonusPaise > 0 && remaining > 0) {
        const deduct = Math.min(user.wallet.bonusPaise, remaining);
        user.wallet.bonusPaise -= deduct;
        remaining -= deduct;
        await TransactionModel.create([{
          publicId: publicId('txn'),
          userId: user._id,
          type: TransactionType.ADMIN_ADJUSTMENT,
          amountPaise: -deduct,
          bucket: WalletBucket.BONUS,
          balanceAfterPaise: user.wallet.bonusPaise,
          description: `Admin manual deduction: ${reason}`,
          idempotencyKey: `adjust:deduct:${user.publicId}:bonus:${Date.now()}:${Math.random()}`,
        }], { session });
      }

      await user.save({ session });
    }

    await audit({
      actor,
      action: 'wallet.adjust',
      targetType: 'User',
      targetId: user._id as Types.ObjectId,
      before: beforeWallet,
      after: user.wallet,
      reason,
    });

    return user;
  });
}

export async function listWithdrawals(status?: string) {
  const filter: Record<string, any> = status ? { status } : {};
  return WithdrawalRequestModel.find(filter)
    .sort({ createdAt: -1 })
    .populate('userId', 'fullName phoneNumber kyc')
    .lean();
}

export async function approveWithdrawal(actor: IUser, withdrawalPublicId: string) {
  const request = await WithdrawalRequestModel.findOne({ publicId: withdrawalPublicId });
  if (!request) throw new NotFoundError('Withdrawal request');

  if (request.status !== 'pending') {
    throw new BadRequestError('Only pending withdrawals can be approved');
  }

  const user = await UserModel.findById(request.userId);
  if (!user) throw new NotFoundError('User');

  if (user.wallet.lockedPaise < request.amountPaise) {
    throw new BadRequestError('Insufficient locked balance to payout');
  }

  return withTransaction(async (session) => {
    request.status = 'paid';
    request.reviewedByAdminId = actor._id as Types.ObjectId;
    request.processedAt = new Date();
    await request.save({ session });

    user.wallet.lockedPaise -= request.amountPaise;
    await user.save({ session });

    await TransactionModel.create([{
      publicId: publicId('txn'),
      userId: user._id,
      amountPaise: -request.amountPaise,
      type: TransactionType.WITHDRAWAL,
      bucket: WalletBucket.WINNINGS,
      balanceAfterPaise: user.wallet.lockedPaise,
      description: `Bank withdrawal paid: request ${request.publicId}`,
      idempotencyKey: `withdraw:payout:${request.publicId}`,
      referenceType: 'WithdrawalRequest',
      referenceId: request._id as Types.ObjectId,
    }], { session });

    await audit({
      actor,
      action: 'withdrawal.approve',
      targetType: 'WithdrawalRequest',
      targetId: request._id as Types.ObjectId,
      after: { status: request.status },
    });

    return request;
  });
}

export async function rejectWithdrawal(actor: IUser, withdrawalPublicId: string, reason: string) {
  const request = await WithdrawalRequestModel.findOne({ publicId: withdrawalPublicId });
  if (!request) throw new NotFoundError('Withdrawal request');

  if (request.status !== 'pending') {
    throw new BadRequestError('Only pending withdrawals can be rejected');
  }

  const user = await UserModel.findById(request.userId);
  if (!user) throw new NotFoundError('User');

  if (user.wallet.lockedPaise < request.amountPaise) {
    throw new BadRequestError('User locked balance is corrupted');
  }

  return withTransaction(async (session) => {
    request.status = 'rejected';
    request.rejectionReason = reason;
    request.reviewedByAdminId = actor._id as Types.ObjectId;
    request.processedAt = new Date();
    await request.save({ session });

    user.wallet.lockedPaise -= request.amountPaise;
    user.wallet.winningsPaise += request.amountPaise;
    await user.save({ session });

    await TransactionModel.create([{
      publicId: publicId('txn'),
      userId: user._id,
      amountPaise: request.amountPaise,
      type: TransactionType.WITHDRAWAL_REVERSAL,
      bucket: WalletBucket.WINNINGS,
      balanceAfterPaise: user.wallet.winningsPaise,
      description: `Bank withdrawal rejected (refunded): ${reason}`,
      idempotencyKey: `withdraw:reversal:${request.publicId}`,
      referenceType: 'WithdrawalRequest',
      referenceId: request._id as Types.ObjectId,
    }], { session });

    await audit({
      actor,
      action: 'withdrawal.reject',
      targetType: 'WithdrawalRequest',
      targetId: request._id as Types.ObjectId,
      after: { status: request.status, rejectionReason: reason },
      reason,
    });

    return request;
  });
}

export async function listSettlements(status?: string) {
  const filter: Record<string, any> = status ? { status } : {};
  return SettlementModel.find(filter)
    .sort({ createdAt: -1 })
    .populate('arenaId', 'name address')
    .lean();
}

export async function approveSettlement(actor: IUser, settlementPublicId: string) {
  const settlement = await SettlementModel.findOne({ publicId: settlementPublicId });
  if (!settlement) throw new NotFoundError('Settlement record');

  if (settlement.status !== 'draft') {
    throw new BadRequestError('Only draft settlements can be approved');
  }

  settlement.status = 'approved';
  settlement.approvedByAdminId = actor._id as Types.ObjectId;
  await settlement.save();

  await audit({
    actor,
    action: 'settlement.approve',
    targetType: 'Settlement',
    targetId: settlement._id as Types.ObjectId,
    after: { status: settlement.status },
  });

  return settlement;
}

export async function getReconciliationReport() {
  const ledgerTotals = await TransactionModel.aggregate([
    { $group: { _id: '$userId', total: { $sum: '$amountPaise' } } }
  ]);

  const users = await UserModel.find().lean();
  const drifts: any[] = [];

  for (const ut of ledgerTotals) {
    const u = users.find((x) => String(x._id) === String(ut._id));
    if (u) {
      const walletTotal =
        u.wallet.depositPaise +
        u.wallet.winningsPaise +
        u.wallet.bonusPaise +
        u.wallet.lockedPaise;

      if (walletTotal !== ut.total) {
        drifts.push({
          userId: u._id,
          userPublicId: u.publicId,
          fullName: u.fullName,
          phoneNumber: u.phoneNumber,
          walletTotal,
          ledgerTotal: ut.total,
          driftPaise: walletTotal - ut.total,
        });
      }
    }
  }

  return {
    reconciledAt: new Date(),
    totalUsersChecked: users.length,
    driftCount: drifts.length,
    drifts,
  };
}

export async function getConfig() {
  return AppConfigModel.find().lean();
}

export async function updateConfig(actor: IUser, key: string, value: any) {
  if (actor.role !== UserRole.SUPER_ADMIN) {
    throw new ForbiddenError('Only super_admin can configure runtime keys');
  }

  const config = await AppConfigModel.findOneAndUpdate(
    { key },
    { value, updatedByUserId: actor._id as Types.ObjectId },
    { upsert: true, new: true }
  );

  await audit({
    actor,
    action: 'config.update',
    targetType: 'AppConfig',
    targetId: config._id as Types.ObjectId,
    after: { key, value },
  });

  return config;
}

export async function getAuditLogs() {
  return AuditLogModel.find()
    .sort({ createdAt: -1 })
    .limit(100)
    .populate('actorUserId', 'fullName role')
    .lean();
}
