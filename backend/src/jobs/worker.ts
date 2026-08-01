import { connectDatabase, disconnectDatabase } from '../shared/config/db.js';
import { logger } from '../shared/config/logger.js';
import { releaseExpiredHolds } from '../modules/booking/booking.service.js';
import { expireUnmatchedChallenges } from '../modules/challenges/challenge.service.js';
import {
  autoResolveExpiredMatches,
  voidStaleMatches,
} from '../modules/matches/match.service.js';
import { materialiseAllArenaSlots } from '../modules/arenas/slot.service.js';

/**
 * Background jobs. Runs as a SEPARATE process from the API — a slow sweep must
 * never block request handling (technical_spec.md §8).
 *
 * Every job is idempotent: if two instances run the same sweep, both are safe
 * because each acts through a conditional update (edge_cases.md §106).
 */

interface Job {
  name: string;
  intervalMs: number;
  run: () => Promise<number>;
}

const JOBS: Job[] = [
  {
    name: 'releaseExpiredHolds',
    intervalMs: 60_000,
    run: () => releaseExpiredHolds(),
  },
  {
    name: 'expireUnmatchedChallenges',
    intervalMs: 5 * 60_000,
    run: () => expireUnmatchedChallenges(),
  },
  {
    name: 'autoResolveMatches',
    intervalMs: 15 * 60_000,
    run: () => autoResolveExpiredMatches(),
  },
  {
    name: 'voidStaleMatches',
    intervalMs: 60 * 60_000,
    run: () => voidStaleMatches(),
  },
  /**
   * Rolls the 30-day booking window forward. Without this an arena simply runs
   * out of bookable slots ~30 days after approval, silently — no error, just an
   * empty grid and an owner who thinks we broke their listing.
   *
   * Hourly rather than the contract's "daily 02:00 IST" because the sweep is
   * idempotent and cheap, and an hourly cadence means a newly-approved arena
   * never waits until tomorrow for its window to extend.
   */
  {
    name: 'materialiseSlots',
    intervalMs: 60 * 60_000,
    run: () => materialiseAllArenaSlots(),
  },
];

async function runJob(job: Job): Promise<void> {
  const startedAt = Date.now();
  try {
    const affected = await job.run();
    if (affected > 0) {
      logger.info({ job: job.name, affected, ms: Date.now() - startedAt }, 'Job completed');
    }
  } catch (err) {
    /** A failing job must never take the worker process down with it. */
    logger.error({ err, job: job.name }, 'Job failed');
  }
}

async function main(): Promise<void> {
  await connectDatabase();
  logger.info({ jobs: JOBS.map((j) => j.name) }, 'Worker started');

  const timers = JOBS.map((job) => {
    void runJob(job);
    return setInterval(() => void runJob(job), job.intervalMs);
  });

  const shutdown = () => {
    timers.forEach(clearInterval);
    void disconnectDatabase().then(() => process.exit(0));
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: unknown) => {
  logger.error({ err }, 'Worker failed to start');
  process.exit(1);
});
