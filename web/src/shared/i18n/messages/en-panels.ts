/**
 * Operator copy: the venue panel and the ops console.
 *
 * Split out of `en.ts` because the catalogue outgrew the file-length cap, and
 * this is the seam that means something — public-site copy is read by players
 * and gets translated first, while panel copy is read by venue owners and ops
 * staff. Merged back into one dictionary in `en.ts`; call sites are unchanged.
 */

export const panels = {
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
