/** Mirrors the backend contract in api_contract.md §12. */

export interface OwnerDashboard {
  gtvPaise: number;
  bookingCount: number;
  onlineCount: number;
  offlineCount: number;
  cancelledCount: number;
  noShowCount: number;
  occupancyPercent: number;
  upcomingCount: number;
}

export type BookingSource = 'app' | 'web' | 'offline_desk' | 'walk_in';

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled_by_user'
  | 'cancelled_by_arena'
  | 'no_show'
  | 'completed'
  | 'expired';

export interface OwnerBooking {
  publicId: string;
  startAt: string;
  endAt: string;
  sport: string;
  status: BookingStatus;
  source: BookingSource;
  totalPaise: number;
  balanceDuePaise: number;
  checkInCode?: string;
  checkedInAt?: string;
  bookerId?: { fullName: string; phoneNumber: string; publicId: string } | null;
  courtId?: { name: string; sport: string } | null;
}

export interface OperatingHours {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface OwnerArena {
  publicId: string;
  name: string;
  slug: string;
  isVerified: boolean;
  bookingMode: string;
  commissionPercent: number;
  address: { areaName: string };
  courts: { _id: string; name: string; sport: string; basePricePerHourPaise: number }[];
  todayBookings: number;
  /** `GET /owner/arenas` returns the whole arena document, so these come free. */
  operatingHours?: OperatingHours[];
  amenities?: string[];
  /** Venue photos, in display order. The first is the public cover image. */
  images?: string[];
  depositPercent?: number;
  settlementCycle?: string;
  cancellationPolicy?: { freeCancellationHours: number; partialRefundPercent: number };
  verificationStatus?: string;
  rejectionReason?: string;
}
