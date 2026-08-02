/**
 * Domain enums — the shared vocabulary across all modules.
 * Ported verbatim from docs/mongodb_schemas.ts. If these drift from the
 * contract, the API contract is wrong. Change the doc first.
 */


export enum SportType {
  CRICKET = 'cricket',
  FOOTBALL = 'football',
  BADMINTON = 'badminton',
}

/** Badminton (and future racquet sports) sub-format. Drives team size. */
export enum MatchFormat {
  SINGLES = 'singles', // 1 v 1
  DOUBLES = 'doubles', // 2 v 2
  TEAM = 'team',       // cricket / football, N v N
}

export enum SkillLevelType {
  BEGINNER = 'beginner',
  INTERMEDIATE = 'intermediate',
  ADVANCED = 'advanced',
}

export enum UserRole {
  PLAYER = 'player',
  ARENA_OWNER = 'arena_owner', // logs into the partner panel, sees only own arenas
  /**
   * "Desk person" — the employee at the counter. Created BY an arena owner.
   * Can see today's bookings, verify check-in codes, and record walk-ins.
   * Cannot see earnings, change pricing, or touch bank details.
   */
  ARENA_STAFF = 'arena_staff',
  ADMIN = 'admin',             // ops staff: disputes, refunds
  SUPER_ADMIN = 'super_admin', // + payouts, config, role grants
}

/** How a venue accepts money. See arena_onboarding.md §4 step 6. */
export enum BookingMode {
  PREPAID_ONLY = 'prepaid_only',
  /** Higher conversion, but creates no-show risk — pair with a deposit. */
  PAY_AT_VENUE_ALLOWED = 'pay_at_venue_allowed',
}

/** Where a booking originated. Arenas take walk-ins we must not double-book. */
export enum BookingSource {
  APP = 'app',
  WEB = 'web',
  OFFLINE_DESK = 'offline_desk', // entered by arena staff
  WALK_IN = 'walk_in',
}

export enum ApplicationStatus {
  SUBMITTED = 'submitted',           // lead captured, wizard not started
  IN_PROGRESS = 'in_progress',
  PENDING_VERIFICATION = 'pending_verification',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  ABANDONED = 'abandoned',
}

export enum AccountStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',   // ops action; cannot play or withdraw
  SELF_EXCLUDED = 'self_excluded', // responsible-gaming opt-out
  DELETED = 'deleted',
}

export enum SlotStatus {
  AVAILABLE = 'available',
  HELD = 'held',       // soft-lock during checkout, expires (see holdExpiresAt)
  BOOKED = 'booked',
  BLOCKED = 'blocked', // owner maintenance / rain / private event
}

export enum BookingStatus {
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  CANCELLED_BY_USER = 'cancelled_by_user',
  CANCELLED_BY_ARENA = 'cancelled_by_arena',
  NO_SHOW = 'no_show',
  COMPLETED = 'completed',
  EXPIRED = 'expired', // hold lapsed before payment landed
}

export enum ChallengeStatus {
  OPEN = 'open',
  MATCHED = 'matched',
  LOCKED = 'locked',      // slot start time reached; no more joins/withdrawals
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',    // never found an opponent; escrow auto-refunded
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  PENDING_SCORES = 'pending_scores',
  PENDING_CONFIRMATION = 'pending_confirmation', // one side submitted
  VERIFIED = 'verified',
  DISPUTED = 'disputed',
  ADMIN_RESOLVED = 'admin_resolved',
  VOIDED = 'voided',      // rain / no-show / mutual abandon -> full refund
  WALKOVER = 'walkover',  // one side absent -> other side awarded
}

export enum TransactionType {
  DEPOSIT = 'deposit',
  WITHDRAWAL = 'withdrawal',
  WITHDRAWAL_REVERSAL = 'withdrawal_reversal',
  ESCROW_HOLD = 'escrow_hold',
  ESCROW_REFUND = 'escrow_refund',
  PRIZE_PAYOUT = 'prize_payout',
  BOOKING_FEE = 'booking_fee',
  BOOKING_REFUND = 'booking_refund',
  PLATFORM_COMMISSION = 'platform_commission',
  BONUS_CREDIT = 'bonus_credit',
  BONUS_EXPIRY = 'bonus_expiry',
  TDS_DEDUCTION = 'tds_deduction',   // s.194BA, 30% on net winnings
  GST_DEDUCTION = 'gst_deduction',   // 28% on deposits, if applicable
  ADMIN_ADJUSTMENT = 'admin_adjustment', // always requires AuditLog entry
}

export enum WalletBucket {
  DEPOSIT = 'deposit',
  WINNINGS = 'winnings',
  BONUS = 'bonus',
}

export enum PaymentProvider {
  RAZORPAY = 'razorpay',
  MOCK = 'mock', // MVP / dev only. Guarded by ENABLE_MOCK_PAYMENTS.
}

export enum PaymentOrderStatus {
  CREATED = 'created',
  ATTEMPTED = 'attempted',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum KycStatus {
  NOT_SUBMITTED = 'not_submitted',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

export enum NotificationType {
  BOOKING_CONFIRMED = 'booking_confirmed',
  BOOKING_CANCELLED = 'booking_cancelled',
  SLOT_REMINDER = 'slot_reminder',
  CHALLENGE_ACCEPTED = 'challenge_accepted',
  CHALLENGE_EXPIRED = 'challenge_expired',
  SCORE_AWAITING_CONFIRMATION = 'score_awaiting_confirmation',
  MATCH_VERIFIED = 'match_verified',
  MATCH_DISPUTED = 'match_disputed',
  DISPUTE_RESOLVED = 'dispute_resolved',
  WALLET_CREDITED = 'wallet_credited',
  WALLET_DEBITED = 'wallet_debited',
  WITHDRAWAL_PROCESSED = 'withdrawal_processed',
  TEAM_INVITE = 'team_invite',
}

/**
 * Where an official came from. Drives `canTriggerPayout`: only a venue's own
 * staff or a platform-verified independent can settle a money match on their
 * scorecard alone (games_rule/badminton.md §1, featuredoc/11 §OF5).
 */
export enum OfficialType {
  VENUE_STAFF = 'venue_staff',
  INDEPENDENT = 'independent',
  /** A team's own person. May officiate and be paid; cannot release escrow. */
  TEAM_ADDED = 'team_added',
}

export enum OfficialVerificationStatus {
  UNVERIFIED = 'unverified',
  PENDING = 'pending',
  VERIFIED = 'verified',
  REJECTED = 'rejected',
}

/** Non-scoring interruptions worth keeping on the record. */
export enum MatchEventType {
  TIMEOUT = 'timeout',
  INJURY = 'injury',
  INTERRUPTION = 'interruption',
  ENDS_CHANGED = 'ends_changed',
}

/**
 * How a rally ended. Optional — an official who just taps the score still
 * produces a valid match; this only enriches the statistics.
 */
export enum PointOutcome {
  WINNER = 'winner',
  UNFORCED_ERROR = 'unforced_error',
  SERVICE_FAULT = 'service_fault',
}
