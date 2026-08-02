/// A player's public profile — `GET /public/players/:publicId`.
///
/// Everything here is derived from settled matches. There is deliberately no
/// constructor that invents a form string or a win rate: a player with no
/// matches has no record, and the UI says so.
class PlayerProfile {
  final String publicId;
  final String fullName;
  final String? avatarUrl;
  final int eloRating;
  final String? primarySport;
  final String? skillLevel;
  final String? homeAreaName;
  final int matchesPlayed;
  final int wins;
  final int losses;

  const PlayerProfile({
    required this.publicId,
    required this.fullName,
    required this.eloRating,
    this.avatarUrl,
    this.primarySport,
    this.skillLevel,
    this.homeAreaName,
    this.matchesPlayed = 0,
    this.wins = 0,
    this.losses = 0,
  });

  bool get hasRecord => matchesPlayed > 0;

  /// Null rather than 0% when nothing has been played — an unplayed player is
  /// not a 0% player.
  double? get winRate => matchesPlayed == 0 ? null : wins / matchesPlayed;

  /// `stats` is one row PER SPORT+FORMAT, so totals are summed and the rating
  /// is taken from the row the player has actually played most — averaging
  /// Elo across formats would produce a number that means nothing.
  factory PlayerProfile.fromJson(Map<String, dynamic> json) {
    final rows = (json['stats'] as List<dynamic>? ?? const [])
        .cast<Map<String, dynamic>>();

    var played = 0;
    var wins = 0;
    var losses = 0;
    Map<String, dynamic>? primaryRow;

    for (final row in rows) {
      played += (row['matchesPlayed'] as num?)?.toInt() ?? 0;
      wins += (row['wins'] as num?)?.toInt() ?? 0;
      losses += (row['losses'] as num?)?.toInt() ?? 0;

      final rowPlayed = (row['matchesPlayed'] as num?)?.toInt() ?? 0;
      final bestPlayed = (primaryRow?['matchesPlayed'] as num?)?.toInt() ?? -1;
      if (rowPlayed > bestPlayed) primaryRow = row;
    }

    return PlayerProfile(
      publicId: json['publicId'] as String? ?? '',
      fullName: json['fullName'] as String? ?? 'Player',
      avatarUrl: json['avatarUrl'] as String?,
      eloRating: (primaryRow?['eloRating'] as num?)?.toInt() ?? 1200,
      primarySport: json['primarySport'] as String?,
      skillLevel: json['skillLevel'] as String?,
      homeAreaName: json['homeAreaName'] as String?,
      matchesPlayed: played,
      wins: wins,
      losses: losses,
    );
  }
}
