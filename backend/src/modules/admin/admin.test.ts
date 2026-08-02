import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Types } from 'mongoose';
import mongoose from 'mongoose';
import { clearDatabase, startTestDatabase, stopTestDatabase } from '../../test/setup.js';
import {
  ArenaApplicationModel,
  ArenaModel,
  ApplicationStatus,
  BookingModel,
  BookingStatus,
  ChallengeModel,
  ChallengeStatus,
  DisputeModel,
  MatchModel,
  MatchStatus,
  ReviewModel,
  SettlementModel,
  TeamModel,
  TransactionModel,
  TransactionType,
  UserModel,
  UserRole,
  WalletBucket,
  WithdrawalRequestModel,
  BookingMode,
  type IUser,
} from '../../models/index.js';
import { withTransaction } from '../../shared/config/db.js';
import { publicId, referralCode } from '../../shared/utils/ids.js';
import {
  partnerApply,
  partnerVerifyPhone,
  updatePartnerApplicationStep,
  submitPartnerApplication,
} from '../partner/partner.service.js';
import {
  getDispute,
  assignDispute,
  resolveDispute,
  adjustWallet,
  approveWithdrawal,
  rejectWithdrawal,
  getReconciliationReport,
} from './admin.service.js';
import { createArenaReview } from '../arenas/arena.service.js';

beforeAll(async () => {
  await startTestDatabase();
  await ArenaModel.ensureIndexes();
});

afterAll(async () => {
  await stopTestDatabase();
});

beforeEach(async () => {
  await clearDatabase();
});

describe('1. Arena Reviews Service', () => {
  it('creates reviews correctly if booking is completed', async () => {
    // 1. Create Owner User
    const owner = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919999999999',
      fullName: 'Arena Owner',
      role: UserRole.ARENA_OWNER,
      referralCode: referralCode(),
    });

    // 2. Create Arena
    const arena = await ArenaModel.create({
      publicId: publicId('arn'),
      name: 'Soccer Zone',
      slug: 'soccer-zone',
      ownerId: owner._id,
      address: { city: 'Lucknow', state: 'UP', country: 'IN', line1: 'Gomti Nagar', pincode: '226010', areaName: 'Gomti Nagar' },
      location: { type: 'Point', coordinates: [80.9462, 26.8467] },
      sports: ['football'],
      contactPhone: '+919999999999',
      isActive: true,
    });

    // 3. Create Court
    const court = await mongoose.connection.collection('courts').insertOne({
      publicId: publicId('crt'),
      arenaId: arena._id,
      name: 'Court 1',
      sport: 'football',
      isActive: true,
      basePricePerHourPaise: 100000,
    });

    // 4. Create Player User
    const player = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919888888888',
      fullName: 'Player 1',
      role: UserRole.PLAYER,
      referralCode: referralCode(),
    });

    // 5. Create a completed booking
    const booking = await BookingModel.create({
      publicId: publicId('bkg'),
      arenaId: arena._id,
      courtId: court.insertedId,
      userId: player._id,
      bookerId: player._id,
      status: BookingStatus.COMPLETED,
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(),
      slots: [],
      pricePaise: 100000,
      commissionPaise: 10000,
      totalPaise: 100000,
      subtotalPaise: 100000,
      sport: 'football',
      idempotencyKey: 'idemp-bkg-' + Date.now(),
    });

    // Create review
    const review = await createArenaReview({
      arenaPublicId: arena.publicId,
      bookingPublicId: booking.publicId,
      user: player,
      rating: 5,
      comment: 'Excellent pitch!',
    });

    expect(review).toBeDefined();
    expect(review.rating).toBe(5);
    expect(review.comment).toBe('Excellent pitch!');

    // Duplicate review should fail
    await expect(
      createArenaReview({
        arenaPublicId: arena.publicId,
        bookingPublicId: booking.publicId,
        user: player,
        rating: 4,
        comment: 'Nice',
      })
    ).rejects.toThrow('already reviewed this booking');
  });
});

describe('2. Partner Onboarding & Wizard Flow', () => {
  it('runs the onboarding wizard and submits it correctly', async () => {
    // 1. Submit application lead
    const lead = {
      ownerName: 'Rahul Verma',
      phoneNumber: '+919777777777',
      venueName: 'Verma Turf',
      areaName: 'Gomti Nagar, Lucknow',
      sports: ['cricket'],
      courtCount: 2,
    };

    const res = await partnerApply(lead);
    expect(res.application).toBeDefined();
    expect(res.devCode).toBeDefined();
    expect(res.application.status).toBe(ApplicationStatus.SUBMITTED);

    // 2. Verify OTP code
    const verifyRes = await partnerVerifyPhone({
      applicationPublicId: res.application.publicId,
      otpCode: res.devCode!,
    });

    expect(verifyRes.accessToken).toBeDefined();
    expect(verifyRes.user.role).toBe(UserRole.ARENA_OWNER);
    expect(verifyRes.application.status).toBe(ApplicationStatus.IN_PROGRESS);

    const ownerUser = verifyRes.user;

    // 3. Step 1-7 filling
    await updatePartnerApplicationStep(ownerUser._id as Types.ObjectId, 1, {
      name: 'Verma Turf Gomti Nagar',
      description: 'Prime cricket arena',
      contactPhone: '9777777777',
      images: [
        'https://example.com/img1.png',
        'https://example.com/img2.png',
        'https://example.com/img3.png',
      ],
    });

    await updatePartnerApplicationStep(ownerUser._id as Types.ObjectId, 2, {
      address: {
        formattedAddress: 'Gomti Nagar, Lucknow',
        areaName: 'Gomti Nagar',
        city: 'Lucknow',
      },
      coordinates: [80.95, 26.85],
      pinConfirmedByOwner: true,
    });

    await updatePartnerApplicationStep(ownerUser._id as Types.ObjectId, 3, [
      { name: 'Pitch A', sport: 'cricket', isIndoor: false, basePricePerHourPaise: 150000 },
    ]);

    await updatePartnerApplicationStep(ownerUser._id as Types.ObjectId, 4, [
      { dayOfWeek: 0, openTime: '06:00', closeTime: '22:00', isClosed: false },
      { dayOfWeek: 1, openTime: '06:00', closeTime: '22:00', isClosed: false },
      { dayOfWeek: 2, openTime: '06:00', closeTime: '22:00', isClosed: false },
      { dayOfWeek: 3, openTime: '06:00', closeTime: '22:00', isClosed: false },
      { dayOfWeek: 4, openTime: '06:00', closeTime: '22:00', isClosed: false },
      { dayOfWeek: 5, openTime: '06:00', closeTime: '22:00', isClosed: false },
      { dayOfWeek: 6, openTime: '06:00', closeTime: '22:00', isClosed: false },
    ]);

    await updatePartnerApplicationStep(ownerUser._id as Types.ObjectId, 5, []);

    await updatePartnerApplicationStep(ownerUser._id as Types.ObjectId, 6, {
      amenities: ['parking', 'water'],
      cancellationPolicy: { freeCancellationHours: 6, partialRefundPercent: 50 },
      bookingMode: BookingMode.PREPAID_ONLY,
    });

    await updatePartnerApplicationStep(ownerUser._id as Types.ObjectId, 7, {
      payout: {
        accountHolderName: 'Verma Turf',
        pan: 'ABCDE1234F',
        vpa: 'verma@upi',
      },
      agreement: {
        commissionPercent: 10,
        settlementCycle: 'weekly',
        acceptedTerms: true,
      },
    });

    // 4. Submit application
    const submitted = await submitPartnerApplication(ownerUser._id as Types.ObjectId);
    expect(submitted.status).toBe(ApplicationStatus.PENDING_VERIFICATION);
    expect(submitted.submittedAt).toBeDefined();
  });
});

describe('3. Admin Disputes & Resolutions', () => {
  it('resolves disputes with voiding and payouts correctly', async () => {
    // 1. Create Admin
    const admin = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919000000000',
      fullName: 'Ops Admin',
      role: UserRole.ADMIN,
      referralCode: referralCode(),
    });

    // 2. Create Match Players
    const userA = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919111111111',
      fullName: 'Player A',
      wallet: { depositPaise: 50000, winningsPaise: 0, bonusPaise: 0, lockedPaise: 0 },
      referralCode: referralCode(),
    });
    const userB = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919222222222',
      fullName: 'Player B',
      wallet: { depositPaise: 50000, winningsPaise: 0, bonusPaise: 0, lockedPaise: 0 },
      referralCode: referralCode(),
    });

    // 3. Create Teams
    const teamA = await TeamModel.create({
      publicId: publicId('tem'),
      name: 'Team A',
      slug: 'team-a',
      captainId: userA._id,
      sport: 'football',
      format: 'team',
    });
    const teamB = await TeamModel.create({
      publicId: publicId('tem'),
      name: 'Team B',
      slug: 'team-b',
      captainId: userB._id,
      sport: 'football',
      format: 'team',
    });

    // 4. Create Owner, Arena, Court & Booking (dependencies for Challenge)
    const owner = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919999999992',
      fullName: 'Owner C',
      role: UserRole.ARENA_OWNER,
      referralCode: referralCode(),
    });
    const arena = await ArenaModel.create({
      publicId: publicId('arn'),
      name: 'Soccer Arena B',
      slug: 'soccer-arena-b',
      ownerId: owner._id,
      address: { city: 'Lucknow', state: 'UP', country: 'IN', line1: 'Gomti Nagar', pincode: '226010', areaName: 'Gomti Nagar' },
      location: { type: 'Point', coordinates: [80.9462, 26.8467] },
      sports: ['football'],
      contactPhone: '+919999999992',
      isActive: true,
    });
    const court = await mongoose.connection.collection('courts').insertOne({
      publicId: publicId('crt'),
      arenaId: arena._id,
      name: 'Court 1',
      sport: 'football',
      isActive: true,
      basePricePerHourPaise: 100000,
    });
    const booking = await BookingModel.create({
      publicId: publicId('bkg'),
      arenaId: arena._id,
      courtId: court.insertedId,
      userId: userA._id,
      bookerId: userA._id,
      status: BookingStatus.COMPLETED,
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(),
      slots: [],
      pricePaise: 100000,
      commissionPaise: 10000,
      totalPaise: 100000,
      subtotalPaise: 100000,
      sport: 'football',
      idempotencyKey: 'idemp-bkg-dispute-' + Date.now(),
    });

    // 5. Create Challenge
    const challenge = await ChallengeModel.create({
      publicId: publicId('chg'),
      creatorUserId: userA._id,
      opponentUserId: userB._id,
      entryFeePaise: 10000,
      prizePoolPaise: 20000,
      status: ChallengeStatus.ACCEPTED,
      matchExpiresAt: new Date(Date.now() + 3600000),
      startAt: new Date(),
      arenaId: arena._id,
      bookingId: booking._id,
      creatorTeamId: teamA._id,
      format: 'team',
      sport: 'football',
    });

    // 6. Create Match
    const match = await MatchModel.create({
      publicId: publicId('mch'),
      challengeId: challenge._id,
      creatorTeamId: teamA._id,
      opponentTeamId: teamB._id,
      status: MatchStatus.PENDING_SCORES,
      sport: 'football',
      scheduledAt: new Date(),
      arenaId: arena._id,
      format: 'team',
    });

    // 7. Create Dispute
    const dispute = await DisputeModel.create({
      matchId: match._id,
      raisedByUserId: userA._id,
      reason: 'score_mismatch',
      description: 'They are cheating',
      slaDueAt: new Date(Date.now() + 86400000),
    });

    // Assign dispute
    const assigned = await assignDispute({ actor: admin, disputeId: dispute.id });
    expect(assigned.status).toBe('under_review');
    expect(assigned.assignedAdminId).toStrictEqual(admin._id);

    // Resolve Dispute as VOID (refunds entry fee)
    const resolved = await resolveDispute(admin, dispute.id, {
      isVoided: true,
      adminNote: 'Voided due to rain.',
    });

    expect(resolved.status).toBe('resolved');
    expect(resolved.resolution?.isVoided).toBe(true);

    const updatedMatch = await MatchModel.findById(match._id);
    expect(updatedMatch?.status).toBe(MatchStatus.VOIDED);

    const updatedChallenge = await ChallengeModel.findById(challenge._id);
    expect(updatedChallenge?.status).toBe(ChallengeStatus.CANCELLED);
  });
});

describe('4. Wallet manual adjustments & Drift integrity reconciliation', () => {
  it('manages manual super_admin adjustments and drift report correctly', async () => {
    const superAdmin = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919333333333',
      fullName: 'Super Admin',
      role: UserRole.SUPER_ADMIN,
      referralCode: referralCode(),
    });

    const user = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919444444444',
      fullName: 'User 1',
      wallet: { depositPaise: 0, winningsPaise: 0, bonusPaise: 0, lockedPaise: 0 },
      referralCode: referralCode(),
    });

    // Credit adjustment
    const updated = await adjustWallet(superAdmin, user.publicId, 10000, 'Bonus cashback');
    expect(updated.wallet.depositPaise).toBe(10000);

    // Verify reconciliation report detects no drift (since adjustments wrote ledger entries)
    let recon = await getReconciliationReport();
    expect(recon.driftCount).toBe(0);

    // Manual balance manipulation (creating drift)
    await UserModel.updateOne({ _id: user._id }, { $set: { 'wallet.depositPaise': 500000 } });

    recon = await getReconciliationReport();
    expect(recon.driftCount).toBe(1);
    expect(recon.drifts[0].driftPaise).toBe(490000); // 500000 - 10000
  });
});

describe('5. Withdrawals manual approval flow', () => {
  it('approves and rejects bank withdrawal requests correctly', async () => {
    const admin = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919555555555',
      fullName: 'Admin 1',
      role: UserRole.ADMIN,
      referralCode: referralCode(),
    });

    const user = await UserModel.create({
      publicId: publicId('usr'),
      phoneNumber: '+919666666666',
      fullName: 'Withdrawal User',
      wallet: { depositPaise: 0, winningsPaise: 0, bonusPaise: 0, lockedPaise: 20000 },
      referralCode: referralCode(),
    });

    const request = await WithdrawalRequestModel.create({
      publicId: publicId('wdr'),
      userId: user._id,
      amountPaise: 20000,
      tdsPaise: 0,
      netPayablePaise: 20000,
      destination: { type: 'bank', accountLast4: '4321', ifsc: 'HDFC0001234' },
      status: 'pending',
      requestedAt: new Date(),
    });

    // Reject request
    const rejected = await rejectWithdrawal(admin, request.publicId, 'Incorrect bank details');
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectionReason).toBe('Incorrect bank details');

    const updatedUser = await UserModel.findById(user._id);
    expect(updatedUser?.wallet.lockedPaise).toBe(0);
    expect(updatedUser?.wallet.winningsPaise).toBe(20000); // Refunded
  });
});
