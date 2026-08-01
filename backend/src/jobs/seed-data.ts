import { SportType, MatchFormat, SkillLevelType, BookingMode } from '../models/index.js';

/**
 * Seed content: real Lucknow venues, plausible Indian names, and the awkward
 * cases every screen must survive — a 40-char team name, Devanagari text, a
 * zero-match player, a venue with one court and no reviews.
 *
 * GeoJSON is [longitude, latitude]. Lucknow is [80.94, 26.84]; swapping them
 * silently relocates every arena to the Indian Ocean (edge_cases.md §78).
 */

export interface SeedCourtDef {
  name: string;
  sport: SportType;
  surface: string;
  isIndoor: boolean;
  pricePaise: number;
}

export interface SeedArenaDef {
  name: string;
  slug: string;
  areaName: string;
  line1: string;
  pincode: string;
  coordinates: [number, number];
  sports: SportType[];
  amenities: string[];
  /** Real ratings left by seeded players. The arena's average is DERIVED
      from these, never stated — see recomputeArenaRating. */
  reviews: { rating: number; comment: string }[];
  bookingMode: BookingMode;
  ownerName: string;
  ownerPhone: string;
  isVerified: boolean;
  courts: SeedCourtDef[];
}

export const SEED_ARENAS: SeedArenaDef[] = [
  {
    name: 'The Turf Arena',
    slug: 'the-turf-arena-gomti-nagar',
    areaName: 'Gomti Nagar',
    line1: 'Vibhuti Khand, near Fun Republic Mall',
    pincode: '226010',
    coordinates: [81.0035, 26.8607],
    sports: [SportType.FOOTBALL, SportType.CRICKET],
    amenities: ['Floodlights', 'Parking', 'Washroom', 'Changing room', 'Drinking water'],
    reviews: [
      { rating: 5, comment: 'Floodlights are proper. Played till 11pm, no issue seeing the ball.' },
      { rating: 4, comment: 'Turf is good, parking fills up fast on weekends.' },
      { rating: 5, comment: 'Box cricket cage is well netted. Nothing goes onto the road.' },
    ],
    bookingMode: BookingMode.PAY_AT_VENUE_ALLOWED,
    ownerName: 'Vikas Mehrotra',
    ownerPhone: '+919810000001',
    isVerified: true,
    courts: [
      { name: 'Turf A', sport: SportType.FOOTBALL, surface: 'Astro turf', isIndoor: false, pricePaise: 120_000 },
      { name: 'Turf B', sport: SportType.FOOTBALL, surface: 'Astro turf', isIndoor: false, pricePaise: 120_000 },
      { name: 'Box Cricket Pitch', sport: SportType.CRICKET, surface: 'Matting', isIndoor: false, pricePaise: 90_000 },
    ],
  },
  {
    name: 'Smash Point Badminton Academy',
    slug: 'smash-point-badminton-aliganj',
    areaName: 'Aliganj',
    line1: 'Sector H, near Kapoorthala crossing',
    pincode: '226024',
    coordinates: [80.9346, 26.8894],
    sports: [SportType.BADMINTON],
    amenities: ['Air conditioned', 'Wooden court', 'Parking', 'Washroom', 'Cafeteria'],
    reviews: [
      { rating: 5, comment: 'Wooden court and AC actually works. Best in Aliganj.' },
      { rating: 5, comment: 'Shuttle drift is minimal with the AC on. Courts are well marked.' },
      { rating: 4, comment: 'Great courts. Cafeteria shuts early on weekdays.' },
    ],
    bookingMode: BookingMode.PREPAID_ONLY,
    ownerName: 'Anjali Bhatnagar',
    ownerPhone: '+919810000002',
    isVerified: true,
    courts: [
      { name: 'Court 1', sport: SportType.BADMINTON, surface: 'Wooden', isIndoor: true, pricePaise: 45_000 },
      { name: 'Court 2', sport: SportType.BADMINTON, surface: 'Wooden', isIndoor: true, pricePaise: 45_000 },
      { name: 'Court 3', sport: SportType.BADMINTON, surface: 'Synthetic', isIndoor: true, pricePaise: 40_000 },
      { name: 'Court 4', sport: SportType.BADMINTON, surface: 'Synthetic', isIndoor: true, pricePaise: 40_000 },
    ],
  },
  {
    name: 'Greenfield Sports Hub',
    slug: 'greenfield-sports-hub-indira-nagar',
    areaName: 'Indira Nagar',
    line1: 'Sector 14, behind Bhootnath Market',
    pincode: '226016',
    coordinates: [80.9812, 26.8768],
    sports: [SportType.CRICKET, SportType.FOOTBALL, SportType.BADMINTON],
    amenities: ['Floodlights', 'Parking', 'Washroom', 'Equipment rental', 'First aid', 'CCTV'],
    reviews: [
      { rating: 4, comment: 'Decent surface for the price. Changing room is basic.' },
      { rating: 5, comment: 'Staff let us start early when the previous slot ended. Sound people.' },
    ],
    bookingMode: BookingMode.PAY_AT_VENUE_ALLOWED,
    ownerName: 'Sanjay Dixit',
    ownerPhone: '+919810000003',
    isVerified: true,
    courts: [
      { name: 'Main Turf', sport: SportType.FOOTBALL, surface: 'Astro turf', isIndoor: false, pricePaise: 140_000 },
      { name: 'Cricket Cage 1', sport: SportType.CRICKET, surface: 'Matting', isIndoor: false, pricePaise: 100_000 },
      { name: 'Shuttle Court', sport: SportType.BADMINTON, surface: 'Synthetic', isIndoor: true, pricePaise: 38_000 },
    ],
  },
  {
    name: 'The Pitch',
    slug: 'the-pitch-hazratganj',
    areaName: 'Hazratganj',
    line1: 'Rana Pratap Marg, opposite Sahara Ganj',
    pincode: '226001',
    coordinates: [80.9462, 26.8543],
    sports: [SportType.FOOTBALL],
    amenities: ['Floodlights', 'Washroom', 'Drinking water'],
    reviews: [
      { rating: 4, comment: 'Fine for a casual game. Nets need replacing on one side.' },
      { rating: 3, comment: 'Surface had a couple of worn patches near the centre.' },
    ],
    bookingMode: BookingMode.PREPAID_ONLY,
    ownerName: 'Imran Siddiqui',
    ownerPhone: '+919810000004',
    isVerified: true,
    courts: [
      { name: '5-a-side Turf', sport: SportType.FOOTBALL, surface: 'Astro turf', isIndoor: false, pricePaise: 110_000 },
    ],
  },
  {
    /** Deliberately sparse: 1 court, no reviews, unverified. Every list must
        render this without looking broken (design_system.md §8.4). */
    name: 'Shuttle Zone',
    slug: 'shuttle-zone-chinhat',
    areaName: 'Chinhat',
    line1: 'Deva Road, near Chinhat Tiraha',
    pincode: '227105',
    coordinates: [81.0421, 26.8889],
    sports: [SportType.BADMINTON],
    amenities: ['Washroom'],
    reviews: [],
    bookingMode: BookingMode.PREPAID_ONLY,
    ownerName: 'Rakesh Pandey',
    ownerPhone: '+919810000005',
    isVerified: false,
    courts: [
      { name: 'Court 1', sport: SportType.BADMINTON, surface: 'Synthetic', isIndoor: true, pricePaise: 32_000 },
    ],
  },
];

export interface SeedPlayerDef {
  fullName: string;
  phone: string;
  areaName: string;
  skillLevel: SkillLevelType;
  primarySport: SportType;
  eloRating: number;
  depositPaise: number;
  winningsPaise: number;
  bonusPaise: number;
}

export const SEED_PLAYERS: SeedPlayerDef[] = [
  { fullName: 'Arjun Srivastava', phone: '+919820000001', areaName: 'Gomti Nagar', skillLevel: SkillLevelType.ADVANCED, primarySport: SportType.BADMINTON, eloRating: 1642, depositPaise: 250_000, winningsPaise: 180_000, bonusPaise: 0 },
  { fullName: 'Priya Verma', phone: '+919820000002', areaName: 'Aliganj', skillLevel: SkillLevelType.ADVANCED, primarySport: SportType.BADMINTON, eloRating: 1588, depositPaise: 120_000, winningsPaise: 95_000, bonusPaise: 10_000 },
  { fullName: 'Imran Qureshi', phone: '+919820000003', areaName: 'Hazratganj', skillLevel: SkillLevelType.ADVANCED, primarySport: SportType.CRICKET, eloRating: 1531, depositPaise: 80_000, winningsPaise: 40_000, bonusPaise: 0 },
  { fullName: 'Rahul Yadav', phone: '+919820000004', areaName: 'Indira Nagar', skillLevel: SkillLevelType.INTERMEDIATE, primarySport: SportType.FOOTBALL, eloRating: 1409, depositPaise: 300_000, winningsPaise: 0, bonusPaise: 20_000 },
  { fullName: 'Sneha Agarwal', phone: '+919820000005', areaName: 'Gomti Nagar', skillLevel: SkillLevelType.INTERMEDIATE, primarySport: SportType.BADMINTON, eloRating: 1376, depositPaise: 60_000, winningsPaise: 15_000, bonusPaise: 0 },
  { fullName: 'Mohammed Faizan', phone: '+919820000006', areaName: 'Chinhat', skillLevel: SkillLevelType.INTERMEDIATE, primarySport: SportType.CRICKET, eloRating: 1298, depositPaise: 45_000, winningsPaise: 0, bonusPaise: 5_000 },
  /** Devanagari — must not break alignment or clip in any table. */
  { fullName: 'विकास मिश्रा', phone: '+919820000007', areaName: 'Jankipuram', skillLevel: SkillLevelType.BEGINNER, primarySport: SportType.BADMINTON, eloRating: 1187, depositPaise: 20_000, winningsPaise: 0, bonusPaise: 0 },
  /** Zero-state player: every stat view must handle this. */
  { fullName: 'Ananya Singh', phone: '+919820000008', areaName: 'Vibhuti Khand', skillLevel: SkillLevelType.BEGINNER, primarySport: SportType.BADMINTON, eloRating: 1200, depositPaise: 0, winningsPaise: 0, bonusPaise: 20_000 },
];

export interface SeedTeamDef {
  name: string;
  sport: SportType;
  format: MatchFormat;
  captainPhone: string;
  memberPhones: string[];
  eloRating: number;
  areaName: string;
}

export const SEED_TEAMS: SeedTeamDef[] = [
  { name: 'Gomti Gladiators', sport: SportType.CRICKET, format: MatchFormat.TEAM, captainPhone: '+919820000003', memberPhones: ['+919820000003', '+919820000006'], eloRating: 1520, areaName: 'Gomti Nagar' },
  { name: 'Aliganj Strikers FC', sport: SportType.FOOTBALL, format: MatchFormat.TEAM, captainPhone: '+919820000004', memberPhones: ['+919820000004'], eloRating: 1465, areaName: 'Aliganj' },
  /** Exactly 40 characters — the maximum. Must ellipsis, never overflow. */
  { name: 'Hazratganj Royal Challengers United XI', sport: SportType.CRICKET, format: MatchFormat.TEAM, captainPhone: '+919820000006', memberPhones: ['+919820000006'], eloRating: 1388, areaName: 'Hazratganj' },
  { name: 'Smash Bros', sport: SportType.BADMINTON, format: MatchFormat.DOUBLES, captainPhone: '+919820000002', memberPhones: ['+919820000002', '+919820000005'], eloRating: 1611, areaName: 'Aliganj' },
  { name: 'Net Ninjas', sport: SportType.BADMINTON, format: MatchFormat.DOUBLES, captainPhone: '+919820000001', memberPhones: ['+919820000001', '+919820000007'], eloRating: 1342, areaName: 'Gomti Nagar' },
];

/** Venue applications waiting in the admin approval queue. */
export const SEED_APPLICATIONS = [
  {
    ownerName: 'Deepak Rastogi',
    phoneNumber: '+919830000001',
    venueName: 'Rastogi Sports Complex',
    areaName: 'Jankipuram',
    sports: [SportType.BADMINTON, SportType.CRICKET],
    courtCount: 3,
    source: 'field_sales' as const,
    /** Fully filled in — ready for the ops checklist. */
    complete: true,
  },
  {
    ownerName: 'Farhan Ahmed',
    phoneNumber: '+919830000002',
    venueName: 'Ahmed Turf Park',
    areaName: 'Rajajipuram',
    sports: [SportType.FOOTBALL],
    courtCount: 2,
    source: 'web' as const,
    complete: true,
  },
  {
    /** Abandoned mid-wizard — the highest-intent lead list ops should call
        (arena_onboarding.md §10, case 3). */
    ownerName: 'Neha Kapoor',
    phoneNumber: '+919830000003',
    venueName: 'Kapoor Badminton Hall',
    areaName: 'Aliganj',
    sports: [SportType.BADMINTON],
    courtCount: 4,
    source: 'app' as const,
    complete: false,
  },
];

export const OPERATING_HOURS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  openTime: '06:00',
  closeTime: '23:00',
  isClosed: false,
}));
