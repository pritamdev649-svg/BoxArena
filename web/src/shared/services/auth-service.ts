import { useMutation, useQuery } from '@tanstack/react-query';
import { clientFetch } from './client-api';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * AUTH SERVICE LAYER
 */

export async function requestOtp(phoneNumber: string) {
  return clientFetch(API_ENDPOINTS.otpRequest, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber }),
  });
}

export async function verifyOtp(phoneNumber: string, code: string) {
  return clientFetch(API_ENDPOINTS.otpVerify, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, code }),
  });
}

export async function fetchCurrentUser(token?: string) {
  return clientFetch(API_ENDPOINTS.usersMe, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * REACT QUERY HOOKS
 */

export function useOtpRequest() {
  return useMutation({
    mutationFn: (phoneNumber: string) => requestOtp(phoneNumber),
  });
}

export function useOtpVerify() {
  return useMutation({
    mutationFn: ({ phoneNumber, code }: { phoneNumber: string; code: string }) =>
      verifyOtp(phoneNumber, code),
  });
}

export function useCurrentUser(token?: string) {
  return useQuery({
    queryKey: ['currentUser', token],
    queryFn: () => fetchCurrentUser(token),
    enabled: !!token,
  });
}
