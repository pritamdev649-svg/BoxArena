import { env } from '../../shared/config/env.js';

/**
 * Match economics (money-calculation spec, MM1–MM2).
 *
 * The principle the whole file rests on: **venue fee and official fee are
 * fixed costs of playing.** They never enter the prize pool and are never paid
 * out of it. Only entry fees form the pool.
 *
 * Pure functions, no I/O — the same maths runs at challenge creation, on the
 * opponent's pre-accept screen, and in tests, and cannot drift between them.
 */

export interface MoneyInput {
  /** Court hire for the slot, total (not per team). */
  venueFeePaise: number;
  /** The official's fee for the match, total. */
  officialFeePaise: number;
  /** Entry fee PER TEAM. This is the only money that becomes prize. */
  entryFeePaise: number;
  /** How many teams are staking. Two for a normal challenge. */
  teamCount?: number;
  commissionPercentEntry?: number;
  commissionPercentVenue?: number;
  commissionPercentOfficial?: number;
}

export interface MoneyBreakdown {
  perTeamCostPaise: number;
  totalEntryPoolPaise: number;
  entryCommissionPaise: number;
  netPrizePoolPaise: number;
  platformRevenuePaise: number;
  /** What the winner is left with after their own costs. Can be negative. */
  winnerNetProfitPaise: number;
  /** What a loser is down. Always negative or zero. */
  loserNetPaise: number;
  /** Lowest entry fee at which the winner does not lose money. */
  suggestedMinimumEntryFeePaise: number;
  /** True when the winner would gain nothing — MM2's soft warning. */
  winnerProfitIsLow: boolean;
  /** The amount the compliance cap is measured against, and the cap itself. */
  cappedAmountPaise: number;
  capPaise: number;
  exceedsCap: boolean;
}

/**
 * The break-even entry fee (MM2, open question Q4 — decided here).
 *
 * The winner receives `E·N·(1−C)` and has paid `E + (V+O)/N`. Solving for a
 * positive profit:
 *
 *   E·N·(1−C) − E − (V+O)/N > 0
 *   E · (N(1−C) − 1)        > (V+O)/N
 *   E                       > (V+O) / (N · (N(1−C) − 1))
 *
 * Rounded UP, because a floor that rounds down is not a floor.
 */
export function suggestedMinimumEntryFee(input: {
  venueFeePaise: number;
  officialFeePaise: number;
  teamCount: number;
  commissionPercentEntry: number;
}): number {
  const { venueFeePaise, officialFeePaise, teamCount } = input;
  const commission = input.commissionPercentEntry / 100;

  const multiplier = teamCount * (1 - commission) - 1;
  /** A single team, or a commission at or above 50%, can never profit. */
  if (multiplier <= 0) return 0;

  return Math.ceil((venueFeePaise + officialFeePaise) / (teamCount * multiplier));
}

export function calculateMatchMoney(input: MoneyInput): MoneyBreakdown {
  const teamCount = input.teamCount ?? 2;
  const commissionPercentEntry = input.commissionPercentEntry ?? env.PLATFORM_COMMISSION_PERCENT;
  const commissionPercentVenue = input.commissionPercentVenue ?? 0;
  const commissionPercentOfficial =
    input.commissionPercentOfficial ?? env.OFFICIAL_COMMISSION_PERCENT;

  /** Costs are shared evenly; the entry fee is per team on top. */
  const perTeamCostPaise =
    Math.ceil(input.venueFeePaise / teamCount) +
    Math.ceil(input.officialFeePaise / teamCount) +
    input.entryFeePaise;

  const totalEntryPoolPaise = input.entryFeePaise * teamCount;

  /**
   * Commission comes out at COLLECTION, so the net prize pool shown before
   * anyone accepts is exactly what the winner receives — no late deduction
   * after a dispute or cancellation (money spec §5, question Q2).
   */
  const entryCommissionPaise = Math.floor(
    (totalEntryPoolPaise * commissionPercentEntry) / 100,
  );
  const netPrizePoolPaise = totalEntryPoolPaise - entryCommissionPaise;

  const platformRevenuePaise =
    entryCommissionPaise +
    Math.floor((input.venueFeePaise * commissionPercentVenue) / 100) +
    Math.floor((input.officialFeePaise * commissionPercentOfficial) / 100);

  /**
   * What the compliance cap measures (question Q6).
   *
   * Defaults to the stake alone; `ENTRY_CAP_INCLUDES_MATCH_COSTS` switches it
   * to total per-team outlay. Whichever it is, it is computed once here so no
   * screen invents its own reading of the limit.
   */
  const cappedAmountPaise = env.ENTRY_CAP_INCLUDES_MATCH_COSTS
    ? perTeamCostPaise
    : input.entryFeePaise;

  return {
    perTeamCostPaise,
    totalEntryPoolPaise,
    entryCommissionPaise,
    netPrizePoolPaise,
    platformRevenuePaise,
    winnerNetProfitPaise: netPrizePoolPaise - perTeamCostPaise,
    /** A loser recovers nothing: their whole outlay is gone. */
    loserNetPaise: -perTeamCostPaise,
    suggestedMinimumEntryFeePaise: suggestedMinimumEntryFee({
      venueFeePaise: input.venueFeePaise,
      officialFeePaise: input.officialFeePaise,
      teamCount,
      commissionPercentEntry,
    }),
    winnerProfitIsLow: netPrizePoolPaise - perTeamCostPaise <= 0,
    cappedAmountPaise,
    capPaise: env.MAX_ENTRY_FEE_PAISE,
    exceedsCap: cappedAmountPaise > env.MAX_ENTRY_FEE_PAISE,
  };
}
