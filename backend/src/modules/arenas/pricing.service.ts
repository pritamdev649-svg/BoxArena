import type { Types } from 'mongoose';
import {
  AppConfigModel,
  PricingRuleModel,
  type ICourt,
  type IPricingRule,
} from '../../models/index.js';
import {
  istDayOfWeek,
  istStartOfDay,
  parseTimeToMinutes,
  toLocalDate,
} from '../../shared/utils/datetime.js';

/**
 * Resolves what a single hour actually costs.
 *
 * Rules are evaluated MOST SPECIFIC FIRST, falling back to
 * `Court.basePricePerHourPaise` when nothing matches (arena_onboarding.md §4
 * step 5). The band a booking was priced by is never stored on the booking —
 * `Slot.pricePaise` is stamped at materialisation and is the only price that
 * matters thereafter, so that changing a rule tomorrow cannot silently reprice
 * a slot someone already looked at.
 */

/** Ops-editable via `PATCH /admin/config/:key`. Empty until they populate it. */
const HOLIDAY_CONFIG_KEY = 'india_holiday_dates';

/**
 * How specific a band is, independent of the owner's `priority` field.
 *
 * `holiday` MUST outrank `weekend`: 15 August on a Saturday charges the holiday
 * rate, not the weekend rate. That ordering is B4's done-when.
 */
const SPECIFICITY: Record<IPricingRule['appliesTo'], number> = {
  specific_date: 400,
  holiday: 300,
  custom_days: 200,
  weekend: 100,
  weekday: 100,
};

const WEEKEND_DAYS: ReadonlySet<number> = new Set([0, 6]);
const MINUTES_IN_DAY = 24 * 60;

export interface PriceContext {
  rules: IPricingRule[];
  holidays: ReadonlySet<string>;
}

/** IST calendar dates ("2026-08-15") ops has flagged as holidays. */
export async function loadHolidayDates(): Promise<ReadonlySet<string>> {
  const row = await AppConfigModel.findOne({ key: HOLIDAY_CONFIG_KEY }).lean();
  if (!row || !Array.isArray(row.value)) return new Set<string>();
  return new Set(row.value.filter((d): d is string => typeof d === 'string'));
}

/**
 * Loads everything needed to price a whole arena at once. Materialising 30 days
 * × N courts must not issue a query per slot.
 */
export async function loadPriceContext(arenaId: Types.ObjectId): Promise<PriceContext> {
  const [rules, holidays] = await Promise.all([
    PricingRuleModel.find({ arenaId, isActive: true }).lean<IPricingRule[]>(),
    loadHolidayDates(),
  ]);
  return { rules, holidays };
}

interface DayContext {
  localDate: string;
  dayOfWeek: number;
  isHoliday: boolean;
}

function matchesDay(rule: IPricingRule, day: DayContext): boolean {
  switch (rule.appliesTo) {
    case 'specific_date':
      return rule.specificDate === day.localDate;
    case 'holiday':
      return day.isHoliday;
    case 'custom_days':
      return rule.daysOfWeek?.includes(day.dayOfWeek) ?? false;
    case 'weekend':
      return WEEKEND_DAYS.has(day.dayOfWeek);
    case 'weekday':
      return !WEEKEND_DAYS.has(day.dayOfWeek);
    default:
      return false;
  }
}

/** `endTime: "00:00"` means midnight-end-of-day, not midnight-start. */
function endMinute(rule: IPricingRule): number {
  const raw = parseTimeToMinutes(rule.endTime);
  return raw === 0 ? MINUTES_IN_DAY : raw;
}

function coversHour(rule: IPricingRule, minuteOfDay: number): boolean {
  return minuteOfDay >= parseTimeToMinutes(rule.startTime) && minuteOfDay < endMinute(rule);
}

function isInEffect(rule: IPricingRule, startAt: Date): boolean {
  if (rule.validFrom && startAt < rule.validFrom) return false;
  if (rule.validTo && startAt > rule.validTo) return false;
  return true;
}

/**
 * Owner-set `priority` wins first (the field is documented "higher wins"), then
 * specificity, then a court-scoped rule over an arena-wide one.
 */
function rank(rule: IPricingRule): number {
  return rule.priority * 1_000 + SPECIFICITY[rule.appliesTo] + (rule.courtId ? 1 : 0);
}

export interface ResolvePriceInput {
  court: Pick<ICourt, '_id' | 'basePricePerHourPaise'>;
  startAt: Date;
  context: PriceContext;
}

/** The hourly price for `startAt` on `court`. Never throws; always returns a price. */
export function resolvePricePaise(input: ResolvePriceInput): number {
  const { court, startAt, context } = input;
  const localDate = toLocalDate(startAt);
  const day: DayContext = {
    localDate,
    dayOfWeek: istDayOfWeek(startAt),
    isHoliday: context.holidays.has(localDate),
  };
  const minuteOfDay = Math.floor((startAt.getTime() - istStartOfDay(startAt).getTime()) / 60_000);

  const applicable = context.rules.filter(
    (rule) =>
      (!rule.courtId || String(rule.courtId) === String(court._id)) &&
      isInEffect(rule, startAt) &&
      matchesDay(rule, day) &&
      coversHour(rule, minuteOfDay),
  );

  if (applicable.length === 0) return court.basePricePerHourPaise;

  return applicable.reduce((best, rule) => (rank(rule) > rank(best) ? rule : best)).pricePerHourPaise;
}
