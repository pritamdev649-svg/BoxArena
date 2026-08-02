/// One row of the ladder — `GET /leaderboards`.
///
/// `rank` is nullable on purpose: a player with no completed matches is listed
/// but not ranked, because a starting Elo nobody has played for is not an
/// achievement. The UI must render that case rather than showing them at #1.
class LeaderboardRow {
  final int? rank;
  final String publicId;
  final String fullName;
  final String? areaName;
  final int eloRating;
  final int matchesPlayed;
  final int wins;
  final int losses;

  /// Most recent first: `['W', 'L', 'W']`. Empty for an unranked player.
  final List<String> form;
  final bool isUnranked;

  const LeaderboardRow({
    required this.publicId,
    required this.fullName,
    required this.eloRating,
    this.rank,
    this.areaName,
    this.matchesPlayed = 0,
    this.wins = 0,
    this.losses = 0,
    this.form = const [],
    this.isUnranked = true,
  });

  factory LeaderboardRow.fromJson(Map<String, dynamic> json) => LeaderboardRow(
        rank: (json['rank'] as num?)?.toInt(),
        publicId: json['publicId'] as String? ?? '',
        fullName: json['fullName'] as String? ?? 'Player',
        areaName: json['areaName'] as String?,
        eloRating: (json['eloRating'] as num?)?.toInt() ?? 1200,
        matchesPlayed: (json['matchesPlayed'] as num?)?.toInt() ?? 0,
        wins: (json['wins'] as num?)?.toInt() ?? 0,
        losses: (json['losses'] as num?)?.toInt() ?? 0,
        form: (json['form'] as List<dynamic>? ?? const [])
            .map((entry) => entry.toString().toUpperCase())
            .toList(),
        isUnranked: json['isUnranked'] as bool? ?? true,
      );
}
