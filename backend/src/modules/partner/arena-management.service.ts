import { Types } from 'mongoose';
import {
  ArenaModel,
  CourtModel,
  PricingRuleModel,
  SlotModel,
  SlotStatus,
  type IArena,
  type ICourt,
  type IUser,
} from '../../models/index.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors/app-error.js';
import {
  istDateTimeToUtc,
  istDayOfWeek,
  istTimeOfDay,
  parseTimeToMinutes,
  toLocalDate,
} from '../../shared/utils/datetime.js';
import { loadPriceContext, resolvePricePaise } from '../arenas/pricing.service.js';
import { materialiseArenaSlots } from '../arenas/slot.service.js';
import type { PricingRuleInput } from '../arenas/pricing.validators.js';
import { assertCanAccessArena, assertOwner } from './partner.service.js';

/**
 * Ongoing venue management — the half of the partner panel that exists after
 * go-live (arena_onboarding.md §7).
 *
 * The rule that governs every function here (§10.4, edge_cases.md §23):
 * **a change must never silently alter an already-booked slot.** Shrinking
 * hours, deactivating a court, or repricing is allowed — but where it collides
 * with a real booking we reject and list the conflicts, and the owner cancels
 * those explicitly (which refunds in full). Quietly repricing a slot a player
 * has already paid for is the kind of thing that ends a partnership.
 */

/** A slot someone has actually committed to. Available slots are free to change. */
const COMMITTED: SlotStatus[] = [SlotStatus.BOOKED, SlotStatus.HELD];

interface Conflict {
  slotId: string;
  courtId: string;
  localDate: string;
  startAt: Date;
  status: SlotStatus;
}

async function findCommittedSlots(filter: Record<string, unknown>): Promise<Conflict[]> {
  const slots = await SlotModel.find({
    ...filter,
    status: { $in: COMMITTED },
    startAt: { $gte: new Date() },
  })
    .select('_id courtId localDate startAt status')
    .limit(50)
    .lean();

  return slots.map((slot) => ({
    slotId: String(slot._id),
    courtId: String(slot.courtId),
    localDate: slot.localDate,
    startAt: slot.startAt,
    status: slot.status,
  }));
}

function rejectOnConflicts(conflicts: Conflict[], action: string): void {
  if (conflicts.length === 0) return;
  throw new ConflictError(
    'SLOT_UNAVAILABLE',
    `Cannot ${action}: ${conflicts.length} upcoming slot(s) are already booked or held. ` +
      'Cancel those bookings first — cancelling refunds the players in full.',
    { conflicts },
  );
}

async function resolveArena(user: IUser, arenaPublicId: string): Promise<IArena> {
  const arena = await ArenaModel.findOne({ publicId: arenaPublicId }).select('_id').lean();
  if (!arena) throw new NotFoundError('Arena');
  return assertCanAccessArena(user, arena._id as Types.ObjectId);
}

// ---------------------------------------------------------------------------
// Hours, amenities, policy
// ---------------------------------------------------------------------------

export interface ArenaSettingsPatch {
  operatingHours?: IArena['operatingHours'];
  amenities?: string[];
  cancellationPolicy?: IArena['cancellationPolicy'];
  bookingMode?: IArena['bookingMode'];
  depositPercent?: number;
  description?: string;
  contactPhone?: string;
}

/** Slots that would fall outside the proposed weekly template. */
function isOutsideHours(slot: { startAt: Date }, hours: IArena['operatingHours']): boolean {
  const day = hours.find((h) => h.dayOfWeek === istDayOfWeek(slot.startAt));
  if (!day || day.isClosed) return true;
  const minute = parseTimeToMinutes(istTimeOfDay(slot.startAt));
  return minute < parseTimeToMinutes(day.openTime) || minute >= parseTimeToMinutes(day.closeTime);
}

export async function updateArenaSettings(input: {
  user: IUser;
  arenaPublicId: string;
  patch: ArenaSettingsPatch;
}): Promise<IArena> {
  assertOwner(input.user);
  const arena = await resolveArena(input.user, input.arenaPublicId);

  if (input.patch.operatingHours && input.patch.operatingHours.length > 0) {
    await applyHoursChange(arena, input.patch.operatingHours);
  }

  Object.assign(arena, stripUndefined(input.patch));
  await arena.save();

  /** Widened hours mean new bookable slots — fill them in immediately. */
  if (input.patch.operatingHours) {
    await materialiseArenaSlots({ arenaId: arena._id as Types.ObjectId });
  }
  return arena;
}

/** Drops now-out-of-hours AVAILABLE slots; refuses if any are committed. */
async function applyHoursChange(arena: IArena, hours: IArena['operatingHours']): Promise<void> {
  const future = await SlotModel.find({ arenaId: arena._id, startAt: { $gte: new Date() } })
    .select('_id startAt status courtId localDate')
    .lean();

  const stranded = future.filter((slot) => isOutsideHours(slot, hours));
  const committed = stranded.filter((slot) => COMMITTED.includes(slot.status));

  rejectOnConflicts(
    committed.map((slot) => ({
      slotId: String(slot._id),
      courtId: String(slot.courtId),
      localDate: slot.localDate,
      startAt: slot.startAt,
      status: slot.status,
    })),
    'shrink operating hours',
  );

  const removable = stranded.filter((slot) => slot.status === SlotStatus.AVAILABLE);
  if (removable.length > 0) {
    await SlotModel.deleteMany({ _id: { $in: removable.map((slot) => slot._id) } });
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

// ---------------------------------------------------------------------------
// Courts
// ---------------------------------------------------------------------------

export interface CourtInput {
  name: string;
  sport: ICourt['sport'];
  surface?: string;
  isIndoor?: boolean;
  capacity?: number;
  basePricePerHourPaise: number;
}

/** Adding a court is always safe — it only creates new inventory. */
export async function addCourt(input: {
  user: IUser;
  arenaPublicId: string;
  court: CourtInput;
}): Promise<ICourt> {
  assertOwner(input.user);
  const arena = await resolveArena(input.user, input.arenaPublicId);

  const existing = await CourtModel.findOne({ arenaId: arena._id, name: input.court.name }).lean();
  if (existing) throw new BadRequestError(`This venue already has a court named "${input.court.name}"`);

  const court = await CourtModel.create({ ...input.court, arenaId: arena._id });
  await materialiseArenaSlots({ arenaId: arena._id as Types.ObjectId });
  return court;
}

export async function updateCourt(input: {
  user: IUser;
  courtId: string;
  patch: Partial<CourtInput> & { isActive?: boolean };
}): Promise<ICourt> {
  assertOwner(input.user);
  const court = await CourtModel.findById(input.courtId);
  if (!court) throw new NotFoundError('Court');
  await assertCanAccessArena(input.user, court.arenaId);

  /** Retiring a court cannot strand people who booked it. */
  if (input.patch.isActive === false) {
    rejectOnConflicts(await findCommittedSlots({ courtId: court._id }), 'deactivate this court');
    await SlotModel.deleteMany({
      courtId: court._id,
      status: SlotStatus.AVAILABLE,
      startAt: { $gte: new Date() },
    });
  }

  Object.assign(court, stripUndefined(input.patch));
  await court.save();
  return court;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/**
 * Writes the owner's bands, then re-prices FUTURE AVAILABLE slots only.
 * Booked and held slots keep the price they were sold at — repricing those
 * would change what a player already agreed to pay.
 */
export async function setPricingRules(input: {
  user: IUser;
  arenaPublicId: string;
  rules: PricingRuleInput[];
  replaceExisting: boolean;
}): Promise<{ ruleCount: number; slotsRepriced: number }> {
  assertOwner(input.user);
  const arena = await resolveArena(input.user, input.arenaPublicId);
  const arenaId = arena._id as Types.ObjectId;

  if (input.replaceExisting) {
    await PricingRuleModel.deleteMany({ arenaId });
  }

  const docs = input.rules.map((rule) => ({
    arenaId,
    ...(rule.courtId ? { courtId: new Types.ObjectId(rule.courtId) } : {}),
    appliesTo: rule.appliesTo,
    daysOfWeek: rule.daysOfWeek ?? [],
    ...(rule.specificDate ? { specificDate: rule.specificDate } : {}),
    startTime: rule.startTime,
    endTime: rule.endTime,
    pricePerHourPaise: rule.pricePerHourPaise,
    priority: rule.priority,
    ...(rule.validFrom ? { validFrom: rule.validFrom } : {}),
    ...(rule.validTo ? { validTo: rule.validTo } : {}),
  }));
  await PricingRuleModel.insertMany(docs);

  return { ruleCount: docs.length, slotsRepriced: await repriceAvailableSlots(arenaId) };
}

async function repriceAvailableSlots(arenaId: Types.ObjectId): Promise<number> {
  const [courts, context, slots] = await Promise.all([
    CourtModel.find({ arenaId, isActive: true }).lean<ICourt[]>(),
    loadPriceContext(arenaId),
    SlotModel.find({ arenaId, status: SlotStatus.AVAILABLE, startAt: { $gte: new Date() } })
      .select('_id courtId startAt pricePaise')
      .lean(),
  ]);

  const courtById = new Map(courts.map((court) => [String(court._id), court]));
  const operations = [];

  for (const slot of slots) {
    const court = courtById.get(String(slot.courtId));
    if (!court) continue;
    const pricePaise = resolvePricePaise({ court, startAt: slot.startAt, context });
    if (pricePaise === slot.pricePaise) continue;
    operations.push({
      updateOne: {
        filter: { _id: slot._id, status: SlotStatus.AVAILABLE },
        update: { $set: { pricePaise } },
      },
    });
  }

  if (operations.length === 0) return 0;
  const result = await SlotModel.bulkWrite(operations);
  return result.modifiedCount;
}

/**
 * The live weekly grid the wizard and panel show BEFORE saving — 7 days ×
 * operating hours, priced by the same resolver the slots use.
 */
export async function pricingPreview(input: {
  user: IUser;
  arenaPublicId: string;
  courtId?: string;
}): Promise<{ courtId: string; courtName: string; grid: PreviewCell[] }[]> {
  assertOwner(input.user);
  const arena = await resolveArena(input.user, input.arenaPublicId);
  const arenaId = arena._id as Types.ObjectId;

  const [courts, context] = await Promise.all([
    CourtModel.find({
      arenaId,
      isActive: true,
      ...(input.courtId ? { _id: new Types.ObjectId(input.courtId) } : {}),
    }).lean<ICourt[]>(),
    loadPriceContext(arenaId),
  ]);

  return courts.map((court) => ({
    courtId: String(court._id),
    courtName: court.name,
    grid: buildPreviewGrid({ arena, court, context }),
  }));
}

export interface PreviewCell {
  dayOfWeek: number;
  hour: number;
  pricePaise: number;
}

function buildPreviewGrid(input: {
  arena: IArena;
  court: ICourt;
  context: Awaited<ReturnType<typeof loadPriceContext>>;
}): PreviewCell[] {
  const { arena, court, context } = input;
  const cells: PreviewCell[] = [];
  const today = new Date();

  for (let offset = 0; offset < 7; offset += 1) {
    const day = new Date(today.getTime() + offset * 86_400_000);
    const dayOfWeek = istDayOfWeek(day);
    const hours = arena.operatingHours.find((h) => h.dayOfWeek === dayOfWeek);
    if (!hours || hours.isClosed) continue;

    const localDate = toLocalDate(day);
    const open = Number(hours.openTime.split(':')[0]);
    const close = Number(hours.closeTime.split(':')[0]);
    for (let hour = open; hour < close; hour += 1) {
      const startAt = istDateTimeToUtc(localDate, `${String(hour).padStart(2, '0')}:00`);
      cells.push({ dayOfWeek, hour, pricePaise: resolvePricePaise({ court, startAt, context }) });
    }
  }
  return cells;
}
