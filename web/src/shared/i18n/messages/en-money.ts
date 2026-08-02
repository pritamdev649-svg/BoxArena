/**
 * Copy for money a player pays or receives: checkout, the booking receipt, and
 * the pre-accept challenge breakdown.
 *
 * Split from `en.ts` because that file outgrew the length cap, and this is the
 * seam worth keeping — these are the strings that must be reviewed most
 * carefully, since a player makes a financial decision from them. Merged back
 * into one dictionary in `en.ts`; call sites are unchanged.
 */

export const moneyCopy = {
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

  /** Pre-accept money breakdown (money spec MM3). */
  challengeMoney: {
    metaTitle: 'Challenge details',
    costHeading: 'What it costs you',
    venueShare: 'Your share of the court',
    officialShare: 'Your share of the official',
    entryFee: 'Entry fee',
    totalToJoin: 'Total to join',
    poolHeading: 'Prize pool',
    totalPool: 'Total entry pool',
    commission: 'Platform commission',
    netPool: 'Net prize pool',
    outcomeHeading: 'What you walk away with',
    ifYouWin: 'If you win',
    ifYouLose: 'If you lose',
    lowProfit: 'The winner barely profits on this challenge.',
    suggestMinimum: 'Break-even entry fee would be about',
    overCap: 'This is above the per-match limit.',
    capHint: 'The current cap is',
    officialVerified: 'A verified official settles this match automatically.',
    officialUnverified: 'The official here cannot release prize money alone — both captains confirm the result.',
    officialNone: 'No official yet. Both captains submit and must agree on the score.',
    confirmLabel:
      'I understand I will pay the total above. If I win I receive the net prize pool, and if I lose I receive nothing.',
    accept: 'Accept challenge',
    accepting: 'Accepting…',
    acceptFailed: 'Could not accept this challenge',
    notFound: 'That challenge no longer exists.',
    disputeWindow: 'Disputes and refunds',
    disputeWindowBody:
      'Both captains confirm the result, or a verified official does it for you. Raise a dispute inside the window and ops review the point-by-point record.',
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
} as const;
