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
 */

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

  panel: {
    signedInAs: 'Signed in as',
    signOut: 'Sign out',
    openNav: 'Open navigation',
    closeNav: 'Close navigation',
    backToSite: 'Back to boxarena.in',
    settings: 'Settings',
    partnerTitle: 'Venue panel',
    adminTitle: 'Ops console',
    sectionManage: 'Manage',
    sectionMoney: 'Money',
    sectionAccount: 'Account',
    sectionQueues: 'Queues',
    sectionPeople: 'People',
    sectionSystem: 'System',
  },

  partnerAuth: {
    metaTitle: 'Venue sign in',
    title: 'Venue sign in',
    description: 'For venue owners and desk staff. Players sign in on the main site.',
    noAccount: 'Don’t have a venue account yet?',
    registerLink: 'Register your venue',
    registerMetaTitle: 'Register your venue',
    registerTitle: 'Register your venue',
    registerDescription:
      'Six details to get started. Nothing goes live until we’ve verified the venue in person.',
    haveAccount: 'Already registered?',
    signInLink: 'Sign in instead',
    ownerNameLabel: 'Your name',
    venueNameLabel: 'Venue name',
    areaLabel: 'Area',
    areaPlaceholder: 'Select an area',
    sportsLabel: 'Sports you offer',
    courtCountLabel: 'How many games can run at the same time?',
    courtCountHint: 'Not how many rooms — how many separate matches can play at once.',
    submit: 'Create venue account',
    noCost: 'No cost, no contract. We verify every venue in person before it goes live.',
    staffNote: 'Desk staff accounts are created by the venue owner, not here.',
  },

  adminAuth: {
    metaTitle: 'Ops sign in',
    title: 'Ops console',
    description: 'Restricted. Every action behind this login is recorded in the audit log.',
    restricted: 'Access is limited to allowlisted BoxArena operations staff.',
  },

  partnerSettings: {
    metaTitle: 'Settings',
    title: 'Venue settings',
    description: 'Hours, amenities and policy for your venue. Changes apply to future slots only.',
    hoursHeading: 'Operating hours',
    hoursBody:
      'The weekly template we generate bookable slots from. Shrinking hours is blocked where it would strand a booking.',
    amenitiesHeading: 'Amenities',
    amenitiesBody: 'What players see on your venue page.',
    policyHeading: 'Cancellation policy',
    policyBody: 'Must match the published refund policy exactly.',
    bookingModeHeading: 'Booking mode',
    bookingModeBody:
      'Pay-at-venue converts better but carries no-show risk, so it requires a forfeitable deposit.',
    staffHeading: 'Desk staff',
    staffBody: 'Staff can take bookings and verify check-ins. They never see earnings or pricing.',
    payoutHeading: 'Payout account',
    payoutBody: 'Where your weekly settlement lands. Changes need ops verification.',
    freeCancellationLabel: 'Free cancellation window (hours)',
    partialRefundLabel: 'Partial refund inside the window (%)',
    depositLabel: 'Deposit required for pay-at-venue (%)',
    save: 'Save changes',
    prepaidOnly: 'Prepaid only',
    payAtVenue: 'Allow pay at venue',
  },

  adminSettings: {
    metaTitle: 'Settings',
    title: 'System settings',
    description: 'Runtime configuration. Every change is written to the audit log.',
    flagsHeading: 'Feature flags',
    flagsBody:
      'Changes take effect without a deploy. Paid challenges stay off until legal and app-store approval land.',
    commissionHeading: 'Commission defaults',
    commissionBody: 'Applied to new venues. Per-arena rates are negotiated at approval.',
    limitsHeading: 'Limits',
    limitsBody: 'Holds, windows and caps that govern booking and scoring.',
    holidaysHeading: 'Holiday calendar',
    holidaysBody:
      'Dates that trigger holiday pricing bands. Ops maintains this; an empty list means no holiday rates ever apply.',
    superAdminOnly: 'Super admin only',
    save: 'Save configuration',
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
} as const;

export type Messages = typeof en;
