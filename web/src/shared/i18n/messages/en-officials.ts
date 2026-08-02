/**
 * Copy for officials — the scoreboard, the marketplace and the captain
 * confirmations that hang off them.
 *
 * Split from `en-panels.ts` because that file outgrew the length cap, and this
 * is the seam that means something: panel copy is read by venue owners and ops
 * staff, this is read by umpires and by captains deciding on one. Merged back
 * into a single dictionary in `en.ts`; call sites are unchanged.
 */

export const officialsCopy = {
  /** The official's live scoring screen (games_rule/badminton.md §3). */
  scoring: {
    metaTitle: 'Score match',
    startMatch: 'Start match',
    starting: 'Starting…',
    startHint: 'Both teams and you are at the venue. Starting locks the scoreboard to this device.',
    serving: 'Serving',
    gameNumber: { one: 'Game {count}', other: 'Game {count}' },
    gameShort: { one: 'G{count}', other: 'G{count}' },
    undo: 'Undo',
    timeout: 'Timeout',
    elapsed: 'Elapsed',
    changeEnds: 'Change ends',
    callServiceOver: 'Service over.',
    callDeuce: 'Deuce.',
    court: 'Court',
    stats: 'Statistics',
    statPoints: 'Points won',
    statOnServe: 'Points won on serve',
    statStreak: 'Longest streak',
    statWinners: 'Winners',
    statErrors: 'Unforced errors',
    statFaults: 'Service faults',
    statTotal: 'Total points played',
    statCorrections: 'Corrections made',
    statsEmpty: 'No rallies recorded yet.',
    outcomeWinner: 'Winner',
    outcomeError: 'Unforced error',
    outcomeFault: 'Service fault',
    outcomeHint: 'Tag the rally (optional)',
    matchComplete: 'Match complete',
    confirmResult: 'Confirm final result',
    confirming: 'Confirming…',
    settled: 'Result confirmed. The winner has been paid.',
    awaitingCaptains: 'Result recorded. Both captains must agree before the prize is released.',
    notYourMatch: 'Only the assigned official can confirm this result.',
    failed: 'That did not go through. Try again.',
    sideA: 'Team A',
    sideB: 'Team B',
  },
} as const;
