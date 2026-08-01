import { useMutation } from '@tanstack/react-query';
import { clientFetch } from './client-api';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * ADMIN SERVICE LAYER
 */

export async function rejectApplicationRequest(publicId: string, reason: string) {
  return clientFetch(API_ENDPOINTS.adminRejectApplication(publicId), {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function verifyApplicationRequest(publicId: string, checklist: Record<string, boolean>) {
  return clientFetch(API_ENDPOINTS.adminVerifyApplication(publicId), {
    method: 'PATCH',
    body: JSON.stringify({ checklist }),
  });
}

export async function approveApplicationRequest(publicId: string) {
  return clientFetch(API_ENDPOINTS.adminApproveApplication(publicId), {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

/**
 * REACT QUERY HOOKS
 */

export function useRejectApplication() {
  return useMutation({
    mutationFn: ({ publicId, reason }: { publicId: string; reason: string }) =>
      rejectApplicationRequest(publicId, reason),
  });
}

export function useVerifyApplication() {
  return useMutation({
    mutationFn: ({ publicId, checklist }: { publicId: string; checklist: Record<string, boolean> }) =>
      verifyApplicationRequest(publicId, checklist),
  });
}

export function useApproveApplication() {
  return useMutation({
    mutationFn: (publicId: string) => approveApplicationRequest(publicId),
  });
}
