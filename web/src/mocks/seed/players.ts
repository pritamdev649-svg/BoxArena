/**
 * Plausible Lucknow players and teams. Includes the awkward cases every
 * layout must survive (design_system.md §8.4):
 *   - a 40-character team name
 *   - Devanagari text
 *   - a player with zero matches
 *   - ELO values spanning the full realistic range
 */

export interface SeedPlayer {
  publicId: string;
  fullName: string;
  areaName: string;
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  eloRating: number;
  matchesPlayed: number;
  wins: number;
  losses: number;
  /** Most recent first: W / L / D */
  form: ('W' | 'L' | 'D')[];
}

export const SEED_PLAYERS: SeedPlayer[] = [
  {
    publicId: 'usr_Kq7mNp2Rt',
    fullName: 'Arjun Srivastava',
    areaName: 'Gomti Nagar',
    skillLevel: 'advanced',
    eloRating: 1642,
    matchesPlayed: 47,
    wins: 31,
    losses: 16,
    form: ['W', 'W', 'L', 'W', 'W'],
  },
  {
    publicId: 'usr_Bn4vXz8Wq',
    fullName: 'Priya Verma',
    areaName: 'Aliganj',
    skillLevel: 'advanced',
    eloRating: 1588,
    matchesPlayed: 52,
    wins: 33,
    losses: 19,
    form: ['W', 'L', 'W', 'W', 'L'],
  },
  {
    publicId: 'usr_Hd9cJk3Ly',
    fullName: 'Imran Qureshi',
    areaName: 'Hazratganj',
    skillLevel: 'advanced',
    eloRating: 1531,
    matchesPlayed: 38,
    wins: 22,
    losses: 16,
    form: ['L', 'W', 'W', 'W', 'D'],
  },
  {
    publicId: 'usr_Ts6bGh1Mn',
    fullName: 'Rahul Yadav',
    areaName: 'Indira Nagar',
    skillLevel: 'intermediate',
    eloRating: 1409,
    matchesPlayed: 29,
    wins: 15,
    losses: 14,
    form: ['W', 'L', 'L', 'W', 'W'],
  },
  {
    publicId: 'usr_Vx2nQw5Zp',
    fullName: 'Sneha Agarwal',
    areaName: 'Gomti Nagar',
    skillLevel: 'intermediate',
    eloRating: 1376,
    matchesPlayed: 24,
    wins: 12,
    losses: 12,
    form: ['L', 'W', 'D', 'W', 'L'],
  },
  {
    publicId: 'usr_Rm8kFd4Xc',
    fullName: 'Mohammed Faizan',
    areaName: 'Chinhat',
    skillLevel: 'intermediate',
    eloRating: 1298,
    matchesPlayed: 19,
    wins: 8,
    losses: 11,
    form: ['L', 'L', 'W', 'L', 'W'],
  },
  {
    /** Devanagari — must not break alignment or clip. */
    publicId: 'usr_Pw3jHs7Nv',
    fullName: 'विकास मिश्रा',
    areaName: 'Jankipuram',
    skillLevel: 'beginner',
    eloRating: 1187,
    matchesPlayed: 11,
    wins: 4,
    losses: 7,
    form: ['L', 'W', 'L', 'L', 'W'],
  },
  {
    /** Zero-state player: every stat view must handle this. */
    publicId: 'usr_Ly5tRb9Kd',
    fullName: 'Ananya Singh',
    areaName: 'Vibhuti Khand',
    skillLevel: 'beginner',
    eloRating: 1200,
    matchesPlayed: 0,
    wins: 0,
    losses: 0,
    form: [],
  },
];

export interface SeedTeam {
  publicId: string;
  name: string;
  sport: 'cricket' | 'football' | 'badminton';
  captainPublicId: string;
  memberCount: number;
  eloRating: number;
  played: number;
  won: number;
  areaName: string;
}

export const SEED_TEAMS: SeedTeam[] = [
  {
    publicId: 'tm_Nx4kPq8Wz',
    name: 'Gomti Gladiators',
    sport: 'cricket',
    captainPublicId: 'usr_Kq7mNp2Rt',
    memberCount: 11,
    eloRating: 1520,
    played: 18,
    won: 12,
    areaName: 'Gomti Nagar',
  },
  {
    publicId: 'tm_Jd7bVc2Xm',
    name: 'Aliganj Strikers FC',
    sport: 'football',
    captainPublicId: 'usr_Hd9cJk3Ly',
    memberCount: 8,
    eloRating: 1465,
    played: 22,
    won: 13,
    areaName: 'Aliganj',
  },
  {
    /** Exactly 40 characters — the maximum. Must ellipsis, never overflow. */
    publicId: 'tm_Qz9nHt5Lp',
    name: 'Hazratganj Royal Challengers United XI',
    sport: 'cricket',
    captainPublicId: 'usr_Ts6bGh1Mn',
    memberCount: 12,
    eloRating: 1388,
    played: 15,
    won: 7,
    areaName: 'Hazratganj',
  },
  {
    publicId: 'tm_Wr3mKf6Bs',
    name: 'Smash Bros',
    sport: 'badminton',
    captainPublicId: 'usr_Bn4vXz8Wq',
    memberCount: 2,
    eloRating: 1611,
    played: 31,
    won: 21,
    areaName: 'Aliganj',
  },
  {
    publicId: 'tm_Cy8pLd1Rn',
    name: 'Net Ninjas',
    sport: 'badminton',
    captainPublicId: 'usr_Vx2nQw5Zp',
    memberCount: 2,
    eloRating: 1342,
    played: 14,
    won: 6,
    areaName: 'Gomti Nagar',
  },
];
