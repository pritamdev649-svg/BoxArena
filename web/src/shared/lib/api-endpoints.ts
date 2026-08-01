/**
 * Centralized registry of all backend API endpoints.
 * Keeps all routes in one place to prevent path drift and simplify refactoring.
 */
export const API_ENDPOINTS = {
  // Common / Player
  usersMe: '/users/me',
  arenas: '/arenas',
  arenaDetail: (slug: string) => `/arenas/${slug}`,
  arenaSlots: (publicId: string, date: string) => `/arenas/${publicId}/slots?date=${date}`,

  // Auth
  otpRequest: '/auth/otp/request',
  otpVerify: '/auth/otp/verify',

  // Owner / Partner panel
  ownerApply: '/owner/apply',
  ownerVerifyPhone: (publicId: string) => `/owner/apply/${publicId}/verify-phone`,
  ownerDashboard: '/owner/dashboard',
  ownerArenas: '/owner/arenas',
  ownerArenaDetail: (publicId: string) => `/owner/arenas/${publicId}`,
  ownerBookings: (limit = 8) => `/owner/bookings?limit=${limit}`,
  ownerApplication: '/owner/application',
  ownerApplicationStep: (step: number) => `/owner/application/step/${step}`,

  // Admin panel / Ops console
  adminOverview: '/admin/overview',
  adminApplications: '/admin/applications',
  adminApplicationDetail: (publicId: string) => `/admin/applications/${publicId}`,
  adminVerifyApplication: (publicId: string) => `/admin/applications/${publicId}/verification`,
  adminApproveApplication: (publicId: string) => `/admin/applications/${publicId}/approve`,
  adminRejectApplication: (publicId: string) => `/admin/applications/${publicId}/reject`,
  adminDisputes: '/admin/disputes',
  adminConfig: '/admin/config',
} as const;
