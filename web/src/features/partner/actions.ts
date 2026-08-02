'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, ApiError } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

export interface UpdateArenaSettingsResult {
  success: boolean;
  error?: string;
  conflictingBookings?: any[];
}

export async function updateArenaSettingsAction(
  publicId: string,
  data: {
    operatingHours?: any[] | undefined;
    amenities?: string[] | undefined;
    cancellationPolicy?: { freeCancellationHours: number; partialRefundPercent: number } | undefined;
    bookingMode?: string | undefined;
    depositPercent?: number | undefined;
    images?: string[] | undefined;
  },
): Promise<UpdateArenaSettingsResult> {
  const token = await getPartnerToken();
  if (!token) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    await apiFetch(API_ENDPOINTS.ownerArenaDetail(publicId), {
      method: 'PATCH',
      token,
      body: data,
    });

    revalidatePath('/partner/settings');
    revalidatePath('/partner/dashboard');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === 'CONFLICT' && Array.isArray(err.details)) {
        return {
          success: false,
          error: err.message,
          conflictingBookings: err.details,
        };
      }
      return { success: false, error: err.message };
    }
    return { success: false, error: 'Failed to update settings' };
  }
}

/**
 * Courts and pricing.
 *
 * Every one of these can collide with a live booking, and the API answers that
 * by refusing and listing the conflicts rather than silently changing a slot
 * someone paid for (arena-management.service.ts §10.4). These actions pass that
 * list straight through so the screen can show which bookings are in the way.
 */
export interface PartnerMutationResult {
  success: boolean;
  error?: string;
  conflicts?: ConflictingSlot[];
}

export interface ConflictingSlot {
  slotId: string;
  courtId: string;
  localDate: string;
  startAt: string;
  status: string;
}

function toResult(err: unknown, fallback: string): PartnerMutationResult {
  if (err instanceof ApiError) {
    const details = err.details as { conflicts?: ConflictingSlot[] } | undefined;
    return {
      success: false,
      error: err.message,
      ...(details?.conflicts ? { conflicts: details.conflicts } : {}),
    };
  }
  return { success: false, error: fallback };
}

/** Both panel screens read courts and prices, so both must re-render. */
function revalidatePartner(): void {
  revalidatePath('/partner/courts');
  revalidatePath('/partner/settings');
  revalidatePath('/partner/dashboard');
}

export interface CourtInput {
  name: string;
  sport: string;
  surface?: string;
  isIndoor?: boolean;
  capacity?: number;
  basePricePerHourPaise: number;
}

export async function addCourtAction(
  arenaPublicId: string,
  court: CourtInput,
): Promise<PartnerMutationResult> {
  const token = await getPartnerToken();
  if (!token) return { success: false, error: 'Unauthorized' };

  try {
    await apiFetch(API_ENDPOINTS.ownerCourts(arenaPublicId), {
      method: 'POST',
      token,
      body: court,
    });
    revalidatePartner();
    return { success: true };
  } catch (err) {
    return toResult(err, 'Could not add that court');
  }
}

export async function updateCourtAction(
  courtId: string,
  patch: Partial<CourtInput> & { isActive?: boolean },
): Promise<PartnerMutationResult> {
  const token = await getPartnerToken();
  if (!token) return { success: false, error: 'Unauthorized' };

  try {
    await apiFetch(API_ENDPOINTS.ownerCourt(courtId), { method: 'PATCH', token, body: patch });
    revalidatePartner();
    return { success: true };
  } catch (err) {
    return toResult(err, 'Could not update that court');
  }
}

export interface PricingRuleInput {
  /** Absent means the band applies to every court in the arena. */
  courtId?: string | undefined;
  appliesTo: 'weekday' | 'weekend' | 'holiday' | 'specific_date' | 'custom_days';
  daysOfWeek?: number[] | undefined;
  specificDate?: string | undefined;
  startTime: string;
  endTime: string;
  pricePerHourPaise: number;
  priority: number;
}

/**
 * Saving bands REPLACES the arena's set. The screen always submits the full
 * list it is showing, so "delete a band" and "edit a band" are the same
 * operation — appending would leave the removed band still in force.
 */
export async function setPricingRulesAction(
  arenaPublicId: string,
  rules: PricingRuleInput[],
): Promise<PartnerMutationResult & { slotsRepriced?: number }> {
  const token = await getPartnerToken();
  if (!token) return { success: false, error: 'Unauthorized' };

  try {
    const result = await apiFetch<{ ruleCount: number; slotsRepriced: number }>(
      API_ENDPOINTS.ownerPricingRules,
      { method: 'POST', token, body: { arenaPublicId, rules, replaceExisting: true } },
    );
    revalidatePartner();
    return { success: true, slotsRepriced: result.slotsRepriced };
  } catch (err) {
    return toResult(err, 'Could not save those price bands');
  }
}

export interface AffectedBooking {
  publicId: string;
  startAt: string;
}

export interface BlockSlotsResult extends PartnerMutationResult {
  blockedCount?: number;
  /**
   * Blocking does NOT cancel existing bookings — it only takes free slots off
   * sale and reports the confirmed bookings inside the window. Cancelling them
   * refunds players, so that stays an explicit decision by the owner.
   */
  affectedBookings?: AffectedBooking[];
}

export async function blockSlotsAction(input: {
  courtId: string;
  from: string;
  to: string;
  reason: string;
}): Promise<BlockSlotsResult> {
  const token = await getPartnerToken();
  if (!token) return { success: false, error: 'Unauthorized' };

  try {
    const result = await apiFetch<{
      blockedCount: number;
      conflictingBookings: AffectedBooking[];
    }>(API_ENDPOINTS.ownerBlockSlots, { method: 'POST', token, body: input });

    revalidatePartner();
    return {
      success: true,
      blockedCount: result.blockedCount,
      affectedBookings: result.conflictingBookings,
    };
  } catch (err) {
    return toResult(err, 'Could not block those slots');
  }
}

export interface UploadSignature {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  uploadUrl: string;
  maxBytes: number;
  allowedFormats: string[];
}

export async function getArenaUploadSignatureAction(): Promise<
  { success: true; data: UploadSignature } | { success: false; error: string }
> {
  const token = await getPartnerToken();
  if (!token) return { success: false, error: 'Unauthorized' };

  try {
    const data = await apiFetch<UploadSignature>(API_ENDPOINTS.uploadSign, {
      method: 'POST',
      token,
      body: { kind: 'arena' },
    });
    return { success: true, data };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not start the upload' };
  }
}
