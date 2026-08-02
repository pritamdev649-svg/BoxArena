'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, apiFetchSafe, ApiError } from '@/shared/lib/api';
import { getPartnerToken } from '@/shared/lib/panel-auth';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * The venue onboarding wizard (F4.2).
 *
 * Every step saves on its own. The owner is on a phone in a turf office being
 * interrupted, so the design assumption is that they WILL close the tab
 * halfway — `currentStep` is what they resume from.
 */
export interface ApplicationSnapshot {
  publicId: string;
  status: string;
  currentStep: number;
  lead: { venueName: string; areaName: string; ownerName: string };
  venue?: { name: string; description?: string; contactPhone: string; images: string[] };
  location?: { address: Record<string, string>; coordinates: [number, number] };
  courts?: { name: string; sport: string; basePricePerHourPaise: number; isIndoor: boolean }[];
  operatingHours?: { dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }[];
  amenities?: string[];
  bookingMode?: string;
}

export interface StepResult {
  success: boolean;
  error?: string;
  currentStep?: number;
}

export async function getApplication(): Promise<ApplicationSnapshot | null> {
  const token = await getPartnerToken();
  if (!token) return null;
  return apiFetchSafe<ApplicationSnapshot>(API_ENDPOINTS.ownerApplication, { token });
}

export async function saveStepAction(step: number, data: unknown): Promise<StepResult> {
  const token = await getPartnerToken();
  if (!token) return { success: false, error: 'Sign in again' };

  try {
    const updated = await apiFetch<ApplicationSnapshot>(
      API_ENDPOINTS.ownerApplicationStep(step),
      { method: 'PATCH', token, body: data as Record<string, unknown> },
    );
    revalidatePath('/partner/onboarding');
    return { success: true, currentStep: updated.currentStep };
  } catch (err) {
    /** The API names the offending field — pass it through verbatim. */
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not save that step' };
  }
}

export async function submitApplicationAction(): Promise<StepResult> {
  const token = await getPartnerToken();
  if (!token) return { success: false, error: 'Sign in again' };

  try {
    await apiFetch(API_ENDPOINTS.ownerApplicationSubmit, { method: 'POST', token, body: {} });
    revalidatePath('/partner/onboarding');
    return { success: true };
  } catch (err) {
    if (err instanceof ApiError) return { success: false, error: err.message };
    return { success: false, error: 'Could not submit your application' };
  }
}
