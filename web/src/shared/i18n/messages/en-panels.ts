/**
 * Operator copy: the venue panel and the ops console.
 *
 * Split out of `en.ts` because the catalogue outgrew the file-length cap, and
 * this is the seam that means something — public-site copy is read by players
 * and gets translated first, while panel copy is read by venue owners and ops
 * staff. Merged back into one dictionary in `en.ts`; call sites are unchanged.
 */

export const panels = {
  /** Officials marketplace (featuredoc/11). */
  officials: {
    metaTitle: 'Become an official',
    title: 'Officiate matches',
    description:
      'Set your own price per match. Verified officials can settle prize money on their scorecard alone.',
    nameLabel: 'Name players will see',
    namePlaceholder: 'R. Sharma',
    sportsLabel: 'Sports you officiate',
    priceLabel: 'Your fee per match (₹)',
    experienceLabel: 'Years of experience',
    register: 'Register as an official',
    registering: 'Registering…',
    registered: 'You are listed.',
    registeredHint:
      'Captains can now find and book you. Submit ID verification to settle prize money without both captains confirming.',
    verificationNote:
      'You can officiate and be paid straight away. Until ops verify your ID, a result you record still needs both captains to agree before prize money moves.',
    failed: 'That did not go through. Try again.',

    confirmMetaTitle: 'Confirm the result',
    confirmHeading: 'The official recorded',
    confirmBody:
      'Prize money is released once both captains agree. If this is wrong, say so — it opens a dispute for ops to review.',
    agree: 'I agree',
    disagree: 'This is wrong',
    sending: 'Sending…',
    settled: 'Both captains agreed. The winner has been paid.',
    awaitingOther: 'Recorded. Waiting for the other captain.',
    disputed: 'Dispute raised. Ops will review the point-by-point record.',
    disputeHint: 'Every rally was logged, so a dispute is reviewed against the full record.',
    notFinished: 'This match has not finished yet.',

    pickMetaTitle: 'Choose an official',
    pickTitle: 'Who officiates this match?',
    pickBody:
      'Both captains must agree before the choice locks. A verified official can settle the result on their own scorecard; anyone else records it and you both confirm afterwards.',
    lockedTitle: 'Official confirmed by both captains.',
    pendingTitle: 'Waiting on both captains to agree.',
    creatorAnswer: 'Home captain:',
    opponentAnswer: 'Away captain:',
    agreed: 'agreed',
    waiting: 'not yet',
    feeDue: 'The fee has not been collected yet.',
    feePaid: 'Fee collected from both sides.',
    collectFee: 'Collect the fee now',
    collecting: 'Collecting…',
    confirmChoice: 'Confirm this official',
    choose: 'Choose',
    chosen: 'Chosen',
    canSettle: 'Can settle prize money',
    needsCaptains: 'Result needs both captains',
    perMatch: 'per match',
    years: { one: '{count} year', other: '{count} years' },
    noneAvailable: 'No officials are listed for this sport yet.',
    saved: 'Saved.',
  },

  partnerSettlements: {
    metaTitle: 'Settlements',
    title: 'Settlements',
    description:
      'Every payment we send you, and exactly which bookings make it up. Weekly, T+3 after the slot date.',
    back: 'All settlements',
    emptyTitle: 'No settlements yet',
    emptyBody:
      'Payouts are prepared weekly, three days after the last slot in the period. Your first one appears once a full week of online bookings has been played.',

    gross: 'Gross online bookings',
    commission: 'Platform commission',
    refunds: 'Refunds to players',
    collectedAtVenue: 'Collected by you at the venue',
    netPayable: 'Net payable',
    paidOn: 'Paid on',
    download: 'Download statement',

    bookingCount: { one: '{count} booking', other: '{count} bookings' },
    noBookings: 'No bookings in this period.',
    date: 'Date',
    time: 'Time',
    reference: 'Booking',
    value: 'Value',

    heldCount: {
      one: '{count} booking held back for an open dispute',
      other: '{count} bookings held back for an open dispute',
    },
    heldHint:
      'These are excluded from this payment. They move into a later settlement once the dispute is resolved.',

    status_draft: 'Draft',
    status_approved: 'Approved',
    status_processing: 'Processing',
    status_paid: 'Paid',
    status_failed: 'Failed',
  },

  partnerCourts: {
    metaTitle: 'Courts & pricing',
    title: 'Courts & pricing',
    description: 'What you sell and what it costs. Price changes apply to future free slots only.',
    noVenueTitle: 'No venue yet',
    noVenueBody: 'Courts and pricing appear once your venue is approved.',

    courtsHeading: 'Courts',
    courtsBody:
      'One court per game that can run at the same time. The base price applies whenever no band covers the hour.',
    noCourts: 'No courts yet. Add the first one below.',
    addCourt: 'Add court',
    nameLabel: 'Court name',
    namePlaceholder: 'Turf A',
    sportLabel: 'Sport',
    surfaceLabel: 'Surface',
    surfacePlaceholder: 'Astro turf',
    priceLabel: 'Base price per hour (₹)',
    basePrice: 'base / hour',
    indoor: 'Indoor',
    retire: 'Retire',
    reactivate: 'Reactivate',
    retired: 'Retired',
    cancel: 'Cancel',
    saving: 'Saving…',
    saved: 'Saved.',

    bandsHeading: 'Price bands',
    bandsBody:
      'Charge more at peak hours. Where bands overlap the most specific one wins: a holiday rate beats a weekend rate, which beats a weekday rate.',
    noBands: 'No bands yet — every hour is charged at the court base price.',
    addBand: 'Add band',
    saveBands: 'Save bands',
    removeBand: 'Remove band',
    appliesTo: 'Applies to',
    appliesTo_weekday: 'Weekdays',
    appliesTo_weekend: 'Weekends',
    appliesTo_holiday: 'Holidays',
    appliesTo_specific_date: 'One date',
    appliesTo_custom_days: 'Chosen days',
    onDate: 'Date',
    from: 'From',
    to: 'To',
    rupeesPerHour: '₹ / hour',
    court: 'Court',
    allCourts: 'All courts',
    repriced: {
      one: 'Saved. {count} upcoming free slot was repriced.',
      other: 'Saved. {count} upcoming free slots were repriced.',
    },

    previewHeading: 'Next seven days',
    previewBody:
      'Priced by the same resolver that stamps real slots, so this is exactly what players will be charged.',
    noPreview: 'Add a court to see the weekly price grid.',
    hour: 'Hour',
    previewLegend: 'Highlighted hours cost more than this court’s cheapest hour.',
    hoursLive: 'Hours come from your operating hours.',
    hoursLink: 'Change them in settings',

    blockHeading: 'Block hours',
    blockBody:
      'Take hours off sale for rain, maintenance or a private event. Existing bookings are never cancelled automatically.',
    blockFrom: 'From',
    blockTo: 'Until',
    reasonLabel: 'Reason',
    reasonPlaceholder: 'Resurfacing',
    blockSlots: 'Block hours',
    blocking: 'Blocking…',
    blocked: {
      one: '{count} free hour taken off sale.',
      other: '{count} free hours taken off sale.',
    },
    stillBooked: {
      one: '{count} booking already exists in that window',
      other: '{count} bookings already exist in that window',
    },
    stillBookedHint:
      'These were left untouched. Cancel them from Bookings if the venue really cannot host them — cancelling refunds the players in full.',
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

  partnerPhotos: {
    heading: 'Venue photos',
    body: 'The first photo is your cover — it is what players see on your listing and on the home page.',
    add: 'Add photos',
    uploading: 'Uploading…',
    cover: 'Cover',
    makeCover: 'Make this the cover photo',
    remove: 'Remove photo',
    uploadFailed: 'Upload failed. Try again.',
    tooLarge: {
      one: 'Each photo must be under {count}MB',
      other: 'Each photo must be under {count}MB',
    },
    hint: {
      one: 'Up to {count} photo. JPG, PNG or WebP. Photos go live when you save.',
      other: 'Up to {count} photos. JPG, PNG or WebP. Photos go live when you save.',
    },
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
} as const;
