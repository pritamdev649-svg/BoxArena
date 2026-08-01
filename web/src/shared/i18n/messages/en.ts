/**
 * Every user-facing string. No copy is written inline in a component.
 *
 * The PRD ships English at MVP with Hindi in Phase 2 (prd.md §6). Structuring
 * as namespaced dictionaries now means the Hindi launch is a new file plus a
 * locale switch, not a hunt through 40 screens.
 *
 * Shape deliberately mirrors next-intl's namespace convention, so adopting it
 * later is mechanical.
 *
 * Plurals use `{ one, other }` and are resolved with Intl.PluralRules — Hindi
 * pluralises differently from English, so hardcoding "s" would not survive
 * translation.
 *
 * Operator-facing copy lives in en-panels.ts and is merged in below, so this
 * file stays the public site's catalogue.
 */

import { panels } from './en-panels';

export const en = {
  common: {
    perHour: 'per hour',
    signIn: 'Sign in',
    verified: 'Verified',
    newVenue: 'New venue',
    accept: 'Accept',
    friendly: 'Friendly',
    rating: 'Rating',
    seeAll: 'See all arenas',
    fullTable: 'Full table',
    courtCount: { one: '{count} court', other: '{count} courts' },
    venueCount: { one: '{count} venue', other: '{count} venues' },
    playerCount: { one: '{count} player', other: '{count} players' },
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    switchToLight: 'Switch to light theme',
    switchToDark: 'Switch to dark theme',
    homeLink: 'BoxArena home',
  },

  nav: {
    arenas: 'Arenas',
    challenges: 'Challenges',
    leaderboard: 'Leaderboard',
    partner: 'For venues',
    partnerDashboard: 'Dashboard',
    partnerBookings: 'Bookings',
    partnerCourts: 'Courts & pricing',
    partnerSettlements: 'Settlements',
    adminOverview: 'Overview',
    adminApplications: 'Applications',
    adminDisputes: 'Disputes',
    adminUsers: 'Users',
    adminAudit: 'Audit log',
  },

  home: {
    eyebrow: 'Lucknow · Box cricket · Turf football · Badminton',
    title: 'Lucknow’s real league.\nBook it. Play it. Win it.',
    description:
      'Every match counts toward the city table. Scores are verified by both sides. Winners get paid automatically.',
    bookCta: 'Book a slot',
    listVenueCta: 'List your venue',
    loopTitlePrefix: 'Others stop at',
    loopTitleAccent: 'book',
    lastNight: 'Last night',
    cityTable: 'City table',
    tonightHeading: 'Free tonight in Lucknow',
    topArenasTitle: 'Top venues in Lucknow',
    topArenasBody:
      'Ranked by players who actually booked and played here. Ratings come from verified bookings only.',
    steps: {
      book: { title: 'Book', body: 'Find a turf or court near you. Real-time availability.' },
      play: { title: 'Play', body: 'Post a challenge. Get matched with teams at your level.' },
      score: { title: 'Score', body: 'Both captains submit. Scores must agree to settle.' },
      rank: {
        title: 'Rank',
        body: 'Separate ratings per sport and format. Your record follows you.',
      },
      win: {
        title: 'Win',
        body: 'Entry fees held in escrow. Paid out the moment a result is verified.',
      },
    },
  },

  arenas: {
    metaTitle: 'Arenas in Lucknow',
    metaDescription:
      'Box cricket, turf football and badminton venues across Gomti Nagar, Aliganj, Hazratganj and more.',
    eyebrow: 'Lucknow',
    title: 'Find a court',
    description: 'Real-time availability across the city. Book by the hour, pay from your wallet.',
    allSports: 'All sports',
    cricket: 'Cricket',
    football: 'Football',
    badminton: 'Badminton',
  },

  /** Checkout: the held-slot confirmation step. */
  checkout: {
    metaTitle: 'Confirm your booking',
    title: 'Confirm your booking',
    court: 'Court',
    date: 'Date',
    time: 'Time',
    duration: 'Duration',
    hours: { one: '{count} hour', other: '{count} hours' },
    total: 'Total',
    heldFor: 'Slots held for',
    paymentHeading: 'How you want to pay',
    payFullLabel: 'Pay the full amount now',
    payFullHint: 'Charged to your BoxArena wallet.',
    payDepositLabel: 'Pay {count}% now, rest at the venue',
    payDepositHint: 'The deposit is forfeited if you do not turn up.',
    payNow: 'Paying now',
    payAtGate: 'Due at the venue',
    walletBalance: 'Wallet balance',
    shortfall: 'Your wallet is short by',
    confirm: 'Confirm booking',
    confirming: 'Confirming…',
    failed: 'Could not confirm your booking',
    releaseNote: 'Your slots are released automatically if you do not confirm in time.',
    expiredTitle: 'Your hold expired',
    expiredBody: 'Those slots went back on sale. Pick your hours again to continue.',
    pickAgain: 'Pick slots again',
    brokenTitle: 'That checkout link is no longer valid',
    brokenBody: 'The slots in this link have changed or are no longer available.',
    browseArenas: 'Find a court',
  },

  /** Booking receipt. */
  booking: {
    metaTitle: 'Your booking',
    confirmedTitle: 'Booking confirmed',
    confirmedBody: 'Show the code below at the venue to check in.',
    checkInCode: 'Check-in code',
    checkInHint: 'The desk verifies this code when you arrive.',
    when: 'When',
    sport: 'Sport',
    reference: 'Reference',
    paid: 'Paid from wallet',
    bookAnother: 'Book another slot',
    notFoundTitle: 'Booking not found',
    notFoundBody: 'We could not find that booking on your account.',
  },

  /** Venue detail page: photos, activity and ratings. */
  arena: {
    galleryLabel: 'Venue photos',
    showPhoto: { one: 'Show photo {count}', other: 'Show photo {count}' },
    prevPhoto: 'Previous photo',
    nextPhoto: 'Next photo',
    noPhotos: 'This venue hasn’t added photos yet',
    statsHeading: 'At this venue',
    statMatches: 'Matches played',
    statPlayers: 'Players hosted',
    statHours: 'Hours booked',
    statCourts: 'Courts',
    statChallenges: 'Open challenges',
    matchCount: { one: '{count} match', other: '{count} matches' },
    reviewsHeading: 'Ratings',
    reviewCount: { one: '{count} rating', other: '{count} ratings' },
    reviewsEmpty: 'No ratings yet. Play here and yours will be the first.',
    reviewAnonymous: 'A player',
    reviewPrompt: 'You played here. How was it?',
    reviewStarLabel: { one: '{count} star', other: '{count} stars' },
    reviewCommentLabel: 'Comment (optional)',
    reviewCommentPlaceholder: 'Lights, surface, parking — what should the next player know?',
    reviewSubmit: 'Post rating',
    reviewSaving: 'Posting…',
    reviewPickRating: 'Pick a star rating first',
    reviewFailed: 'Could not save your rating',
    reviewThanks: 'Thanks — your rating is live.',
    reviewSignedOut: 'Sign in after playing here to rate this venue.',
    reviewNeedsBooking: 'Only players who have played here can rate this venue.',
  },

  leaderboard: {
    metaTitle: 'Lucknow city table',
    metaDescription: 'Badminton, box cricket and turf football rankings across Lucknow.',
    eyebrow: 'Badminton · Singles',
    title: 'City table',
    description: 'Ratings update the moment a result is verified by both sides.',
    columnRank: '#',
    columnPlayer: 'Player',
    columnForm: 'Form',
    columnRating: 'Rating',
    unrankedNote:
      'Players with no completed matches start at 1200 and are unranked until their first result.',
    recentForm: 'Recent form',
  },

  challenges: {
    metaTitle: 'Open challenges',
    metaDescription:
      'Find an opponent at your level. Entry fees held in escrow until a result is verified.',
    eyebrow: 'Matchmaking',
    title: 'Open challenges',
    description:
      'Post a slot you’ve booked, set an entry fee, and get matched with a team at your level.',
    postCta: 'Post a challenge',
  },

  partner: {
    metaTitle: 'List your venue',
    metaDescription: 'Fill your empty slots and get paid on time. Weekly settlements, no lock-in.',
    eyebrow: 'For venue owners',
    title: 'Fill your empty slots. Get paid on time.',
    description:
      'BoxArena brings Lucknow’s players to your turf, handles the money, and settles weekly.',
    applyCta: 'List your venue',
    payoutsCta: 'How payouts work',
    costTitle: 'What it costs',
    points: {
      fill: {
        title: 'Fill your off-peak hours',
        body: 'Most turfs run 40% empty before 4pm. We put those hours in front of players actively looking to book right now.',
      },
      paid: {
        title: 'Get paid weekly, on time',
        body: 'Settlements every Monday for the previous week, T+3 after the slot date. You see exactly which bookings make up each payment.',
      },
      setup: {
        title: 'Ten minutes to set up',
        body: 'Add your courts, hours and pricing. We verify the venue in person, then you go live. No hardware, no contract.',
      },
      walkins: {
        title: 'Keep your walk-ins',
        body: 'Your desk staff record phone and walk-in bookings in two taps, so we never double-book a court you already sold.',
      },
    },
    cost: {
      commission: {
        label: 'Commission',
        value: '10%',
        note: 'On online bookings only. Walk-ins you record are free.',
      },
      setup: {
        label: 'Setup fee',
        value: '₹0',
        note: 'No onboarding cost, no monthly minimum, no lock-in.',
      },
      settlement: {
        label: 'Settlement',
        value: 'Weekly',
        note: 'Straight to your bank account or UPI, every Monday.',
      },
    },
  },

  auth: {
    metaTitle: 'Sign in',
    title: 'Sign in',
    description: 'We’ll text you a 6-digit code. No password to remember.',
    phoneLabel: 'Mobile number',
    phonePlaceholder: '98765 43210',
    dialCode: '+91',
    sendCode: 'Send code',
    terms: 'By continuing you agree to our Terms and Privacy Policy.',
    codeLabel: 'Verification code',
    codePlaceholder: '000000',
    codeSentTo: 'Code sent to',
    verify: 'Verify and continue',
    changeNumber: 'Use a different number',
    resendIn: 'Resend code in',
    resend: 'Resend code',
    verifying: 'Verifying…',
    sending: 'Sending…',
    invalidPhone: 'Enter a 10-digit Indian mobile number',
    invalidCode: 'Enter the 6-digit code',
    devCodeNotice: 'Development mode: Use code',
  },

  footer: {
    tagline: 'Lucknow’s box cricket, turf football and badminton league.',
    play: 'Play',
    venues: 'Venues',
    legal: 'Legal',
    findArena: 'Find an arena',
    openChallenges: 'Open challenges',
    cityTable: 'City table',
    listVenue: 'List your venue',
    payouts: 'How payouts work',
    terms: 'Terms',
    privacy: 'Privacy',
    refunds: 'Refunds & cancellation',
    responsibleGaming: 'Responsible gaming',
    grievance: 'Grievance officer',
    location: 'Lucknow, Uttar Pradesh',
  },

  /** Venue panel and ops console copy — see en-panels.ts. */
  ...panels,
} as const;

export type Messages = typeof en;
