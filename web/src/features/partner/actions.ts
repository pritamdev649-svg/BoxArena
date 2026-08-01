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
