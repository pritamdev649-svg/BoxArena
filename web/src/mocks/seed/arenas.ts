/**
 * Real Lucknow venues and areas. Coordinates are genuine [lng, lat] pairs
 * within the city — swapping them puts Lucknow in the Indian Ocean
 * (edge_cases.md §78).
 *
 * No "Arena A", no lorem ipsum. Layouts built on placeholder content stop
 * surviving contact with reality (design_system.md §8.4).
 */

export const LUCKNOW_AREAS = [
  'Gomti Nagar',
  'Aliganj',
  'Hazratganj',
  'Indira Nagar',
  'Jankipuram',
  'Vibhuti Khand',
  'Chinhat',
  'Rajajipuram',
] as const;

export type LucknowArea = (typeof LUCKNOW_AREAS)[number];

export type Sport = 'cricket' | 'football' | 'badminton';

export interface SeedCourt {
  id: string;
  name: string;
  sport: Sport;
  surface: string;
  isIndoor: boolean;
  basePricePerHourPaise: number;
}

export interface SeedArena {
  publicId: string;
  slug: string;
  name: string;
  areaName: LucknowArea;
  addressLine: string;
  /** GeoJSON order: [longitude, latitude]. */
  coordinates: [number, number];
  sports: Sport[];
  amenities: string[];
  rating: { average: number; count: number };
  courts: SeedCourt[];
  openTime: string;
  closeTime: string;
  isVerified: boolean;
  bookingMode: 'prepaid_only' | 'pay_at_venue_allowed';
  freeCancellationHours: number;
}

export const SEED_ARENAS: SeedArena[] = [
  {
    publicId: 'arn_7k2mQx9pLw',
    slug: 'the-turf-arena-gomti-nagar',
    name: 'The Turf Arena',
    areaName: 'Gomti Nagar',
    addressLine: 'Vibhuti Khand, near Fun Republic Mall',
    coordinates: [81.0035, 26.8607],
    sports: ['football', 'cricket'],
    amenities: ['Floodlights', 'Parking', 'Washroom', 'Changing room', 'Drinking water'],
    rating: { average: 4.6, count: 128 },
    openTime: '06:00',
    closeTime: '23:00',
    isVerified: true,
    bookingMode: 'pay_at_venue_allowed',
    freeCancellationHours: 12,
    courts: [
      {
        id: 'crt_a1',
        name: 'Turf A',
        sport: 'football',
        surface: 'Astro turf',
        isIndoor: false,
        basePricePerHourPaise: 120000,
      },
      {
        id: 'crt_a2',
        name: 'Turf B',
        sport: 'football',
        surface: 'Astro turf',
        isIndoor: false,
        basePricePerHourPaise: 120000,
      },
      {
        id: 'crt_a3',
        name: 'Box Cricket Pitch',
        sport: 'cricket',
        surface: 'Matting',
        isIndoor: false,
        basePricePerHourPaise: 90000,
      },
    ],
  },
  {
    publicId: 'arn_3nR8vTc5Yb',
    slug: 'smash-point-badminton-aliganj',
    name: 'Smash Point Badminton Academy',
    areaName: 'Aliganj',
    addressLine: 'Sector H, near Kapoorthala crossing',
    coordinates: [80.9346, 26.8894],
    sports: ['badminton'],
    amenities: ['Air conditioned', 'Wooden court', 'Parking', 'Washroom', 'Cafeteria'],
    rating: { average: 4.8, count: 214 },
    openTime: '05:30',
    closeTime: '22:30',
    isVerified: true,
    bookingMode: 'prepaid_only',
    freeCancellationHours: 6,
    courts: [
      {
        id: 'crt_b1',
        name: 'Court 1',
        sport: 'badminton',
        surface: 'Wooden',
        isIndoor: true,
        basePricePerHourPaise: 45000,
      },
      {
        id: 'crt_b2',
        name: 'Court 2',
        sport: 'badminton',
        surface: 'Wooden',
        isIndoor: true,
        basePricePerHourPaise: 45000,
      },
      {
        id: 'crt_b3',
        name: 'Court 3',
        sport: 'badminton',
        surface: 'Synthetic',
        isIndoor: true,
        basePricePerHourPaise: 40000,
      },
      {
        id: 'crt_b4',
        name: 'Court 4',
        sport: 'badminton',
        surface: 'Synthetic',
        isIndoor: true,
        basePricePerHourPaise: 40000,
      },
    ],
  },
  {
    publicId: 'arn_9wZ4hJd2Kq',
    slug: 'greenfield-sports-hub-indira-nagar',
    name: 'Greenfield Sports Hub',
    areaName: 'Indira Nagar',
    addressLine: 'Sector 14, behind Bhootnath Market',
    coordinates: [80.9812, 26.8768],
    sports: ['cricket', 'football', 'badminton'],
    amenities: ['Floodlights', 'Parking', 'Washroom', 'Equipment rental', 'First aid', 'CCTV'],
    rating: { average: 4.3, count: 76 },
    openTime: '06:00',
    closeTime: '24:00',
    isVerified: true,
    bookingMode: 'pay_at_venue_allowed',
    freeCancellationHours: 24,
    courts: [
      {
        id: 'crt_c1',
        name: 'Main Turf',
        sport: 'football',
        surface: 'Astro turf',
        isIndoor: false,
        basePricePerHourPaise: 140000,
      },
      {
        id: 'crt_c2',
        name: 'Cricket Cage 1',
        sport: 'cricket',
        surface: 'Matting',
        isIndoor: false,
        basePricePerHourPaise: 100000,
      },
      {
        id: 'crt_c3',
        name: 'Shuttle Court',
        sport: 'badminton',
        surface: 'Synthetic',
        isIndoor: true,
        basePricePerHourPaise: 38000,
      },
    ],
  },
  {
    publicId: 'arn_5tY6bNm1Ax',
    slug: 'the-pitch-hazratganj',
    name: 'The Pitch',
    areaName: 'Hazratganj',
    addressLine: 'Rana Pratap Marg, opposite Sahara Ganj',
    coordinates: [80.9462, 26.8543],
    sports: ['football'],
    amenities: ['Floodlights', 'Washroom', 'Drinking water'],
    rating: { average: 3.9, count: 41 },
    openTime: '07:00',
    closeTime: '22:00',
    isVerified: true,
    bookingMode: 'prepaid_only',
    freeCancellationHours: 12,
    courts: [
      {
        id: 'crt_d1',
        name: '5-a-side Turf',
        sport: 'football',
        surface: 'Astro turf',
        isIndoor: false,
        basePricePerHourPaise: 110000,
      },
    ],
  },
  {
    publicId: 'arn_2qE7uIo8Vz',
    slug: 'champions-court-jankipuram',
    name: 'Champions Court',
    areaName: 'Jankipuram',
    addressLine: 'Sector F, near Engineering College crossing',
    coordinates: [80.9201, 26.9124],
    sports: ['badminton', 'cricket'],
    amenities: ['Air conditioned', 'Parking', 'Washroom', 'Cafeteria', 'Changing room'],
    rating: { average: 4.5, count: 93 },
    openTime: '06:00',
    closeTime: '23:00',
    isVerified: true,
    bookingMode: 'pay_at_venue_allowed',
    freeCancellationHours: 12,
    courts: [
      {
        id: 'crt_e1',
        name: 'Court 1',
        sport: 'badminton',
        surface: 'Wooden',
        isIndoor: true,
        basePricePerHourPaise: 50000,
      },
      {
        id: 'crt_e2',
        name: 'Court 2',
        sport: 'badminton',
        surface: 'Wooden',
        isIndoor: true,
        basePricePerHourPaise: 50000,
      },
      {
        id: 'crt_e3',
        name: 'Box Cricket',
        sport: 'cricket',
        surface: 'Turf',
        isIndoor: false,
        basePricePerHourPaise: 95000,
      },
    ],
  },
  {
    publicId: 'arn_8dF3gHj4Cw',
    slug: 'skyline-turf-vibhuti-khand',
    name: 'Skyline Turf',
    areaName: 'Vibhuti Khand',
    addressLine: 'Near Lohia Park Gate 2',
    coordinates: [81.0098, 26.8523],
    sports: ['football', 'cricket'],
    amenities: ['Floodlights', 'Parking', 'Washroom', 'Cafeteria'],
    rating: { average: 4.1, count: 58 },
    openTime: '06:00',
    closeTime: '23:30',
    isVerified: true,
    bookingMode: 'prepaid_only',
    freeCancellationHours: 12,
    courts: [
      {
        id: 'crt_f1',
        name: 'Turf 1',
        sport: 'football',
        surface: 'Astro turf',
        isIndoor: false,
        basePricePerHourPaise: 130000,
      },
      {
        id: 'crt_f2',
        name: 'Turf 2',
        sport: 'cricket',
        surface: 'Matting',
        isIndoor: false,
        basePricePerHourPaise: 85000,
      },
    ],
  },
  {
    /** Deliberately sparse: 1 court, no reviews, few amenities.
        Every list must render this without looking broken (§8.4). */
    publicId: 'arn_6yU9iOp0Bn',
    slug: 'shuttle-zone-chinhat',
    name: 'Shuttle Zone',
    areaName: 'Chinhat',
    addressLine: 'Deva Road, near Chinhat Tiraha',
    coordinates: [81.0421, 26.8889],
    sports: ['badminton'],
    amenities: ['Washroom'],
    rating: { average: 0, count: 0 },
    openTime: '06:00',
    closeTime: '21:00',
    isVerified: false,
    bookingMode: 'prepaid_only',
    freeCancellationHours: 6,
    courts: [
      {
        id: 'crt_g1',
        name: 'Court 1',
        sport: 'badminton',
        surface: 'Synthetic',
        isIndoor: true,
        basePricePerHourPaise: 32000,
      },
    ],
  },
  {
    publicId: 'arn_4aS5dFg6Hj',
    slug: 'royal-sports-complex-rajajipuram',
    name: 'Royal Sports Complex',
    areaName: 'Rajajipuram',
    addressLine: 'Block C, near Buddheshwar Chauraha',
    coordinates: [80.8845, 26.8452],
    sports: ['cricket', 'badminton'],
    amenities: ['Floodlights', 'Parking', 'Washroom', 'Equipment rental'],
    rating: { average: 4.0, count: 34 },
    openTime: '06:30',
    closeTime: '22:00',
    isVerified: true,
    bookingMode: 'pay_at_venue_allowed',
    freeCancellationHours: 12,
    courts: [
      {
        id: 'crt_h1',
        name: 'Cricket Ground',
        sport: 'cricket',
        surface: 'Matting',
        isIndoor: false,
        basePricePerHourPaise: 80000,
      },
      {
        id: 'crt_h2',
        name: 'Badminton Hall',
        sport: 'badminton',
        surface: 'Wooden',
        isIndoor: true,
        basePricePerHourPaise: 42000,
      },
    ],
  },
];
