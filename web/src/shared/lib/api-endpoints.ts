
export const API_ENDPOINTS = {
    // Common / Player
    usersMe: '/users/me',
    arenas: '/arenas',
    arenaTop: (limit = 4) => `/arenas/top?limit=${limit}`,
    arenaDetail: (slug: string) => `/arenas/${slug}`,
    arenaSlots: (publicId: string, date: string) => `/arenas/${publicId}/slots?date=${date}`,
    arenaReviews: (publicId: string, limit = 10) => `/arenas/${publicId}/reviews?limit=${limit}`,
    arenaCreateReview: (publicId: string) => `/arenas/${publicId}/reviews`,
    arenaReviewEligibility: (publicId: string) => `/arenas/${publicId}/reviews/eligibility`,
    uploadSign: '/uploads/sign',

    // Live scoring (official's device)
    matchLive: (publicId: string) => `/matches/${publicId}/live`,
    matchLiveStart: (publicId: string) => `/matches/${publicId}/live/start`,
    matchLivePoint: (publicId: string) => `/matches/${publicId}/live/point`,
    matchLiveUndo: (publicId: string) => `/matches/${publicId}/live/undo`,
    matchLiveEvent: (publicId: string) => `/matches/${publicId}/live/event`,
    matchLiveConfirm: (publicId: string) => `/matches/${publicId}/live/confirm`,
    officialMyMatches: '/officials/me/matches',
    matchStats: (publicId: string) => `/matches/${publicId}/live/stats`,
    matchConfirmResult: (publicId: string) => `/matches/${publicId}/result/confirm`,
    matchOfficialFee: (publicId: string) => `/matches/${publicId}/official-fee`,
    matchCollectOfficialFee: (publicId: string) => `/matches/${publicId}/official-fee/collect`,
    matchProposeOfficial: (publicId: string) => `/matches/${publicId}/official`,
    matchConfirmOfficial: (publicId: string) => `/matches/${publicId}/official/confirm`,
    officials: '/officials',
    challengeDetail: (publicId: string) => `/challenges/${publicId}`,
    challengeQuote: '/challenges/quote',
    officialDetail: (publicId: string) => `/officials/${publicId}`,

    // Booking / checkout
    bookingHold: '/bookings/hold',
    bookingConfirm: '/bookings',
    bookingDetail: (publicId: string) => `/bookings/${publicId}`,
    wallet: '/wallet',

    // Auth
    otpRequest: '/auth/otp/request',
    otpVerify: '/auth/otp/verify',
    socketToken: '/auth/socket-token',

    // Owner / Partner panel
    ownerApply: '/owner/apply',
    ownerVerifyPhone: (publicId: string) => `/owner/apply/${publicId}/verify-phone`,
    ownerDashboard: '/owner/dashboard',
    ownerArenas: '/owner/arenas',
    ownerArenaDetail: (publicId: string) => `/owner/arenas/${publicId}`,
    ownerBookings: (limit = 8) => `/owner/bookings?limit=${limit}`,
    ownerApplication: '/owner/application',
    ownerApplicationStep: (step: number) => `/owner/application/step/${step}`,
    ownerCourts: (arenaPublicId: string) => `/owner/arenas/${arenaPublicId}/courts`,
    ownerCourt: (courtId: string) => `/owner/courts/${courtId}`,
    ownerPricingRules: '/owner/pricing-rules',
    ownerPricingRulesFor: (arenaPublicId: string) =>
        `/owner/pricing-rules?arenaPublicId=${arenaPublicId}`,
    ownerPricingPreview: (arenaPublicId: string) =>
        `/owner/pricing-preview?arenaPublicId=${arenaPublicId}`,
    ownerBlockSlots: '/owner/slots/block',
    ownerSettlements: '/owner/settlements',
    ownerSettlement: (publicId: string) => `/owner/settlements/${publicId}`,

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
