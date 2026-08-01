import { useQuery } from '@tanstack/react-query';
import { clientFetch } from './client-api';
import { API_ENDPOINTS } from '@/shared/lib/api-endpoints';

/**
 * PARTNER SERVICE LAYER
 */

export async function fetchPartnerDashboard(token?: string) {
  return clientFetch(API_ENDPOINTS.ownerDashboard, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function fetchPartnerArenas(token?: string) {
  return clientFetch(API_ENDPOINTS.ownerArenas, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

export async function fetchPartnerBookings(limit = 8, token?: string) {
  return clientFetch(API_ENDPOINTS.ownerBookings(limit), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

/**
 * REACT QUERY HOOKS
 */

export function usePartnerDashboard(token?: string) {
  return useQuery({
    queryKey: ['partnerDashboard', token],
    queryFn: () => fetchPartnerDashboard(token),
    enabled: !!token,
  });
}

export function usePartnerArenas(token?: string) {
  return useQuery({
    queryKey: ['partnerArenas', token],
    queryFn: () => fetchPartnerArenas(token),
    enabled: !!token,
  });
}

export function usePartnerBookings(limit = 8, token?: string) {
  return useQuery({
    queryKey: ['partnerBookings', limit, token],
    queryFn: () => fetchPartnerBookings(limit, token),
    enabled: !!token,
  });
}
