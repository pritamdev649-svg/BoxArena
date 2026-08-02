/// A venue as the API returns it.
///
/// Lives here rather than in a mock file because every field on it now comes
/// from `GET /arenas` — the fixture list this class used to sit beside is gone.
class Arena {
  final String publicId;
  final String name;
  final String location;
  final String areaName;

  /// Derived server-side from real reviews. Zero reviews means zero rating —
  /// never a flattering default.
  final double rating;
  final int reviewsCount;

  final List<String> sportsSupported;
  final List<String> amenities;
  final int basePricePerHourPaise;

  /// Uploaded by the venue owner. Empty until they upload one.
  final String? imageUrl;

  const Arena({
    required this.publicId,
    required this.name,
    required this.location,
    required this.areaName,
    required this.rating,
    required this.reviewsCount,
    required this.sportsSupported,
    required this.amenities,
    required this.basePricePerHourPaise,
    this.imageUrl,
  });

  bool get hasRating => reviewsCount > 0;
}

/// Counted from bookings and settled matches, not stored — see `getArenaStats`.
class ArenaStats {
  final int matchesPlayed;
  final int playersHosted;
  final int hoursBooked;
  final int openChallenges;
  final int courtCount;

  const ArenaStats({
    this.matchesPlayed = 0,
    this.playersHosted = 0,
    this.hoursBooked = 0,
    this.openChallenges = 0,
    this.courtCount = 0,
  });

  factory ArenaStats.fromJson(Map<String, dynamic> json) => ArenaStats(
        matchesPlayed: (json['matchesPlayed'] as num?)?.toInt() ?? 0,
        playersHosted: (json['playersHosted'] as num?)?.toInt() ?? 0,
        hoursBooked: (json['hoursBooked'] as num?)?.toInt() ?? 0,
        openChallenges: (json['openChallenges'] as num?)?.toInt() ?? 0,
        courtCount: (json['courtCount'] as num?)?.toInt() ?? 0,
      );
}

/// One settled match played at a venue — `GET /arenas/:publicId/matches`.
class ArenaMatch {
  final String publicId;
  final String sport;
  final String creator;
  final String opponent;
  final String? winner;
  final String? scoreline;
  final DateTime playedAt;

  const ArenaMatch({
    required this.publicId,
    required this.sport,
    required this.creator,
    required this.opponent,
    required this.playedAt,
    this.winner,
    this.scoreline,
  });

  factory ArenaMatch.fromJson(Map<String, dynamic> json) => ArenaMatch(
        publicId: json['publicId'] as String? ?? '',
        sport: json['sport'] as String? ?? '',
        creator: json['creator'] as String? ?? 'Team',
        opponent: json['opponent'] as String? ?? 'Team',
        winner: json['winner'] as String?,
        scoreline: json['scoreline'] as String?,
        playedAt: DateTime.parse(json['playedAt'] as String).toLocal(),
      );
}
