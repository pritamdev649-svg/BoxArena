import 'package:flutter/material.dart';

class MockArena {
  final String publicId;
  final String name;
  final String location;
  final String areaName;
  final double rating;
  final int reviewsCount;
  final List<String> sportsSupported;
  final List<String> amenities;
  final int basePricePerHourPaise;
  final String imageUrl;

  MockArena({
    required this.publicId,
    required this.name,
    required this.location,
    required this.areaName,
    required this.rating,
    required this.reviewsCount,
    required this.sportsSupported,
    required this.amenities,
    required this.basePricePerHourPaise,
    required this.imageUrl,
  });
}

class MockPlayer {
  final String publicId;
  final String fullName;
  final String avatarUrl;
  final int eloRating;
  final String primarySport;
  final String skillLevel;
  final String homeAreaName;
  final String form; // e.g. "W W L W D"

  MockPlayer({
    required this.publicId,
    required this.fullName,
    required this.avatarUrl,
    required this.eloRating,
    required this.primarySport,
    required this.skillLevel,
    required this.homeAreaName,
    required this.form,
  });
}

class MockChallenge {
  final String publicId;
  final String creatorTeamName;
  final String creatorCaptainName;
  final String sport;
  final String arenaName;
  final String date;
  final String time;
  final int entryFeePaise;
  final int prizePoolPaise;
  final String skillLevel;
  final String status; // "open" | "matched"
  final List<String>? squadPlayers;
  final String? teamFormat;

  MockChallenge({
    required this.publicId,
    required this.creatorTeamName,
    required this.creatorCaptainName,
    required this.sport,
    required this.arenaName,
    required this.date,
    required this.time,
    required this.entryFeePaise,
    required this.prizePoolPaise,
    required this.skillLevel,
    required this.status,
    this.squadPlayers,
    this.teamFormat,
  });
}

class SeedData {
  static final List<MockArena> arenas = [
    MockArena(
      publicId: "arena-vibhuti",
      name: "The Vibhuti Box Arena",
      location: "Vibhuti Khand, Gomti Nagar, Lucknow",
      areaName: "Gomti Nagar",
      rating: 4.8,
      reviewsCount: 142,
      sportsSupported: ["Badminton", "Box Cricket", "Turf Football"],
      amenities: ["Floodlights", "Water Station", "Locker Rooms", "Parking"],
      basePricePerHourPaise: 120000, // ₹1,200.00
      imageUrl: "https://images.unsplash.com/photo-1540747737956-37872404f802?q=80&w=600",
    ),
    MockArena(
      publicId: "arena-aliganj",
      name: "Aliganj Turf & Smash Nets",
      location: "Sector H, Aliganj, Lucknow",
      areaName: "Aliganj",
      rating: 4.6,
      reviewsCount: 98,
      sportsSupported: ["Badminton", "Box Cricket"],
      amenities: ["Floodlights", "Changing Rooms", "Power Backup"],
      basePricePerHourPaise: 95000, // ₹950.00
      imageUrl: "https://images.unsplash.com/photo-1510563800743-aed2364902be?q=80&w=600",
    ),
    MockArena(
      publicId: "arena-hazratganj",
      name: "Hazratganj Sports Hub",
      location: "Sapru Marg, Hazratganj, Lucknow",
      areaName: "Hazratganj",
      rating: 4.9,
      reviewsCount: 210,
      sportsSupported: ["Badminton", "Turf Football"],
      amenities: ["Lounge", "Floodlights", "Bibs & Showers", "Parking"],
      basePricePerHourPaise: 150000, // ₹1,500.00
      imageUrl: "https://images.unsplash.com/photo-1459865264687-595d652de67e?q=80&w=600",
    ),
    MockArena(
      publicId: "arena-indiranagar",
      name: "Indira Nagar Smash Academy",
      location: "Sector 14, Indira Nagar, Lucknow",
      areaName: "Indira Nagar",
      rating: 4.5,
      reviewsCount: 76,
      sportsSupported: ["Badminton"],
      amenities: ["Synthetic Courts", "Coaching Clinic", "Washrooms"],
      basePricePerHourPaise: 80000, // ₹800.00
      imageUrl: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?q=80&w=600",
    ),
  ];

  static final List<MockPlayer> players = [
    MockPlayer(
      publicId: "player-aman",
      fullName: "Aman Tripathi",
      avatarUrl: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=150",
      eloRating: 1450,
      primarySport: "Badminton",
      skillLevel: "Advanced",
      homeAreaName: "Gomti Nagar",
      form: "W W L W W",
    ),
    MockPlayer(
      publicId: "player-rishabh",
      fullName: "Rishabh Shukla",
      avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=150",
      eloRating: 1320,
      primarySport: "Box Cricket",
      skillLevel: "Intermediate",
      homeAreaName: "Aliganj",
      form: "W L W W D",
    ),
    MockPlayer(
      publicId: "player-shreya",
      fullName: "Shreya Dwivedi",
      avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=150",
      eloRating: 1280,
      primarySport: "Badminton",
      skillLevel: "Intermediate",
      homeAreaName: "Hazratganj",
      form: "L W W L W",
    ),
    MockPlayer(
      publicId: "player-vikram",
      fullName: "Vikram Chaudhary",
      avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=150",
      eloRating: 1510,
      primarySport: "Turf Football",
      skillLevel: "Advanced",
      homeAreaName: "Indira Nagar",
      form: "W W W L W",
    ),
  ];

  static final List<MockChallenge> challenges = [
    MockChallenge(
      publicId: "challenge-1",
      creatorTeamName: "Gomti Smashers",
      creatorCaptainName: "Aman Tripathi",
      sport: "Badminton",
      arenaName: "The Vibhuti Box Arena",
      date: "Aug 15",
      time: "07:00 PM - 08:00 PM",
      entryFeePaise: 50000, // ₹500.00
      prizePoolPaise: 90000, // ₹900.00 (₹100 platform fee)
      skillLevel: "Advanced",
      status: "open",
    ),
    MockChallenge(
      publicId: "challenge-2",
      creatorTeamName: "Aliganj Knights",
      creatorCaptainName: "Rishabh Shukla",
      sport: "Box Cricket",
      arenaName: "Aliganj Turf & Smash Nets",
      date: "Aug 16",
      time: "06:00 PM - 07:00 PM",
      entryFeePaise: 100000, // ₹1,000.00
      prizePoolPaise: 180000, // ₹1,800.00
      skillLevel: "Intermediate",
      status: "open",
    ),
    MockChallenge(
      publicId: "challenge-3",
      creatorTeamName: "Ganj Warriors",
      creatorCaptainName: "Shreya Dwivedi",
      sport: "Badminton",
      arenaName: "Hazratganj Sports Hub",
      date: "Aug 15",
      time: "08:00 PM - 09:00 PM",
      entryFeePaise: 30000, // ₹300.00
      prizePoolPaise: 54000, // ₹540.00
      skillLevel: "Intermediate",
      status: "open",
    ),
  ];
}
