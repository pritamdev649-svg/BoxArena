import { z } from 'zod';

/** "06:00" / "23:00". Rejects "6:00" so band comparisons are never string-fragile. */
const timeOfDay = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/u, 'Use HH:mm, e.g. "06:00"');

/** IST calendar date, "2026-10-20". */
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/u, 'Use YYYY-MM-DD');

/**
 * One pricing band. Shared by the onboarding wizard (step 5) and the owner's
 * ongoing `POST /owner/pricing-rules`, so both paths produce identical rows —
 * a band that behaves differently depending on where it was created is exactly
 * the "why did it charge that?" support ticket arena_onboarding.md §4 warns about.
 */
export const pricingRuleInputSchema = z
  .object({
    courtId: z.string().optional(),
    appliesTo: z.enum(['weekday', 'weekend', 'holiday', 'specific_date', 'custom_days']),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
    specificDate: localDate.optional(),
    startTime: timeOfDay,
    endTime: timeOfDay,
    pricePerHourPaise: z.number().int().min(0),
    priority: z.number().int().min(0).max(1000).default(0),
    validFrom: z.coerce.date().optional(),
    validTo: z.coerce.date().optional(),
  })
  .strict()
  .refine((rule) => rule.appliesTo !== 'specific_date' || Boolean(rule.specificDate), {
    message: 'specificDate is required when appliesTo is "specific_date"',
    path: ['specificDate'],
  })
  .refine((rule) => rule.appliesTo !== 'custom_days' || (rule.daysOfWeek?.length ?? 0) > 0, {
    message: 'daysOfWeek is required when appliesTo is "custom_days"',
    path: ['daysOfWeek'],
  })
  .refine((rule) => rule.startTime < rule.endTime || rule.endTime === '00:00', {
    message: 'endTime must be after startTime ("00:00" means end of day)',
    path: ['endTime'],
  });

export type PricingRuleInput = z.infer<typeof pricingRuleInputSchema>;

export const createPricingRulesSchema = z
  .object({
    arenaPublicId: z.string().min(1),
    rules: z.array(pricingRuleInputSchema).min(1).max(50),
    /** Replaces the arena's existing bands instead of appending to them. */
    replaceExisting: z.boolean().default(false),
  })
  .strict();

export const pricingPreviewSchema = z
  .object({
    arenaPublicId: z.string().min(1),
    courtId: z.string().optional(),
  })
  .strict();

/**
 * Wizard step 5 stores bands as untyped `Record<string, unknown>[]`. Parse
 * leniently at approval: a malformed band must not block a venue going live,
 * it must just not become a rule.
 */
export function parseApplicationPricingRules(raw: unknown): PricingRuleInput[] {
  if (!Array.isArray(raw)) return [];
  const parsed: PricingRuleInput[] = [];
  for (const candidate of raw) {
    const result = pricingRuleInputSchema.safeParse(candidate);
    if (result.success) parsed.push(result.data);
  }
  return parsed;
}
