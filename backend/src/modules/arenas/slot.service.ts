import type { Types } from 'mongoose';
import { ArenaModel, CourtModel, SlotModel, type IArena, type ICourt } from '../../models/index.js';
import { logger } from '../../shared/config/logger.js';
import { NotFoundError } from '../../shared/errors/app-error.js';
import { istDateTimeToUtc, istDayOfWeek, toLocalDate } from '../../shared/utils/datetime.js';
import { loadPriceContext, resolvePricePaise, type PriceContext } from './pricing.service.js';

/**
 * Turns an arena's weekly `operatingHours` template into concrete hourly Slot
 * rows (arena_onboarding.md §4 step 4).
 *
 * Runs BOTH on approval (first 30 days) and daily from the worker, so the
 * window rolls forward. Without the recurring pass a live arena simply stops
 * having bookable slots ~30 days after go-live.
 *
 * Idempotent by construction: the unique index on {courtId, startAt} means
 * re-materialising an overlapping range is a no-op, so running it twice — or
 * from two worker instances — is safe (edge_cases.md §106).
 */

const DEFAULT_DAYS_AHEAD = 30;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

interface SlotDoc {
  arenaId: Types.ObjectId;
  courtId: Types.ObjectId;
  sport: ICourt['sport'];
  startAt: Date;
  endAt: Date;
  localDate: string;
  pricePaise: number;
}

interface BuildInput {
  arena: Pick<IArena, '_id' | 'operatingHours'>;
  courts: ICourt[];
  context: PriceContext;
}

function buildDaySlots(input: BuildInput & { day: Date }): SlotDoc[] {
  const { arena, courts, context, day } = input;
  const hours = arena.operatingHours.find((h) => h.dayOfWeek === istDayOfWeek(day));
  if (!hours || hours.isClosed) return [];

  const localDate = toLocalDate(day);
  const openHour = Number(hours.openTime.split(':')[0]);
  const closeHour = Number(hours.closeTime.split(':')[0]);
  const docs: SlotDoc[] = [];

  for (const court of courts) {
    for (let hour = openHour; hour < closeHour; hour += 1) {
      const startAt = istDateTimeToUtc(localDate, `${String(hour).padStart(2, '0')}:00`);
      /** Never materialise the past — it would show as bookable. */
      if (startAt.getTime() < Date.now()) continue;

      docs.push({
        arenaId: arena._id as Types.ObjectId,
        courtId: court._id as Types.ObjectId,
        sport: court.sport,
        startAt,
        endAt: new Date(startAt.getTime() + HOUR_MS),
        localDate,
        pricePaise: resolvePricePaise({ court, startAt, context }),
      });
    }
  }
  return docs;
}

/** Mongo signals "some rows already existed" as a bulk write error, not a throw we should swallow whole. */
function insertedCountFrom(err: unknown): number | null {
  if (typeof err !== 'object' || err === null) return null;
  const candidate = err as { code?: number; insertedDocs?: unknown[]; result?: { nInserted?: number } };
  const isDuplicate = candidate.code === 11_000 || Array.isArray(candidate.insertedDocs);
  if (!isDuplicate) return null;
  return candidate.result?.nInserted ?? candidate.insertedDocs?.length ?? 0;
}

export interface MaterialiseInput {
  arenaId: Types.ObjectId;
  daysAhead?: number;
}

/** Materialises a rolling window for one arena. Returns rows actually created. */
export async function materialiseArenaSlots(input: MaterialiseInput): Promise<number> {
  const daysAhead = input.daysAhead ?? DEFAULT_DAYS_AHEAD;
  const [arena, courts, context] = await Promise.all([
    ArenaModel.findById(input.arenaId).lean<IArena>(),
    CourtModel.find({ arenaId: input.arenaId, isActive: true }).lean<ICourt[]>(),
    loadPriceContext(input.arenaId),
  ]);
  if (!arena) throw new NotFoundError('Arena');
  if (courts.length === 0) return 0;

  const docs: SlotDoc[] = [];
  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset += 1) {
    docs.push(...buildDaySlots({ arena, courts, context, day: new Date(Date.now() + dayOffset * DAY_MS) }));
  }
  if (docs.length === 0) return 0;

  try {
    const inserted = await SlotModel.insertMany(docs, { ordered: false });
    return inserted.length;
  } catch (err) {
    const partial = insertedCountFrom(err);
    /** Only duplicates are expected. Anything else is a real failure. */
    if (partial === null) throw err;
    return partial;
  }
}

/**
 * The daily cron pass. Sweeps every live arena so the booking window keeps
 * rolling forward without anyone touching the admin panel.
 */
export async function materialiseAllArenaSlots(): Promise<number> {
  const arenas = await ArenaModel.find({ isActive: true, isVerified: true })
    .select('_id')
    .lean<{ _id: Types.ObjectId }[]>();

  let total = 0;
  for (const arena of arenas) {
    try {
      total += await materialiseArenaSlots({ arenaId: arena._id });
    } catch (err) {
      /** One misconfigured arena must not stop the rest of the city. */
      logger.error({ err, arenaId: String(arena._id) }, 'Slot materialisation failed for arena');
    }
  }
  return total;
}
