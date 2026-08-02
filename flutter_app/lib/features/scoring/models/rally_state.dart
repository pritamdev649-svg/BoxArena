/// Mirrors the server's badminton engine state (badminton-engine.ts).
///
/// Deliberately a dumb transport shape: the app never computes a score, it
/// renders what the server derived. Any scoring rule implemented here would be
/// a second source of truth, which is exactly what officials exist to prevent.
class GameScore {
  final int creator;
  final int opponent;

  const GameScore({required this.creator, required this.opponent});

  factory GameScore.fromJson(Map<String, dynamic> json) => GameScore(
        creator: (json['creator'] as num?)?.toInt() ?? 0,
        opponent: (json['opponent'] as num?)?.toInt() ?? 0,
      );
}

/// Which player of each pair stands in the right-hand service court.
class DoublesPositions {
  final int creatorRightIndex;
  final int opponentRightIndex;

  const DoublesPositions({
    required this.creatorRightIndex,
    required this.opponentRightIndex,
  });

  factory DoublesPositions.fromJson(Map<String, dynamic> json) => DoublesPositions(
        creatorRightIndex: (json['creatorRightIndex'] as num?)?.toInt() ?? 0,
        opponentRightIndex: (json['opponentRightIndex'] as num?)?.toInt() ?? 0,
      );
}

class RallyState {
  final int bestOf;
  final List<GameScore> games;
  final GameScore current;
  final int currentGameNumber;
  final String serving;
  final bool isComplete;
  final String? winner;

  /// 'right' or 'left' — derived server-side from the server's own score.
  final String serveCourt;

  /// Null in singles.
  final DoublesPositions? doubles;

  const RallyState({
    required this.bestOf,
    required this.games,
    required this.current,
    required this.currentGameNumber,
    required this.serving,
    required this.isComplete,
    required this.winner,
    required this.serveCourt,
    required this.doubles,
  });

  factory RallyState.fromJson(Map<String, dynamic> json) => RallyState(
        bestOf: (json['bestOf'] as num?)?.toInt() ?? 3,
        games: ((json['games'] as List?) ?? [])
            .map((g) => GameScore.fromJson(g as Map<String, dynamic>))
            .toList(),
        current: GameScore.fromJson(
          (json['current'] as Map<String, dynamic>?) ?? const {},
        ),
        currentGameNumber: (json['currentGameNumber'] as num?)?.toInt() ?? 1,
        serving: json['serving'] as String? ?? 'creator',
        isComplete: json['isComplete'] as bool? ?? false,
        winner: json['winner'] as String?,
        serveCourt: json['serveCourt'] as String? ?? 'right',
        doubles: json['doubles'] == null
            ? null
            : DoublesPositions.fromJson(json['doubles'] as Map<String, dynamic>),
      );

  bool get isDoubles => doubles != null;

  /// Games won so far, for the "2–1" line on the finished screen.
  ({int creator, int opponent}) get gamesWon {
    var c = 0;
    var o = 0;
    for (final game in games) {
      if (game.creator > game.opponent) {
        c += 1;
      } else {
        o += 1;
      }
    }
    return (creator: c, opponent: o);
  }
}

/// Everything the scoreboard needs in one payload.
class LiveMatch {
  final String matchPublicId;
  final String status;
  final DateTime? startedAt;
  final List<String> creatorNames;
  final List<String> opponentNames;
  final RallyState state;

  const LiveMatch({
    required this.matchPublicId,
    required this.status,
    required this.startedAt,
    required this.creatorNames,
    required this.opponentNames,
    required this.state,
  });

  factory LiveMatch.fromJson(Map<String, dynamic> json) => LiveMatch(
        matchPublicId: json['matchPublicId'] as String? ?? '',
        status: json['status'] as String? ?? 'scheduled',
        startedAt:
            json['startedAt'] == null ? null : DateTime.tryParse(json['startedAt'] as String),
        creatorNames: ((json['creatorNames'] as List?) ?? ['Team A']).cast<String>(),
        opponentNames: ((json['opponentNames'] as List?) ?? ['Team B']).cast<String>(),
        state: RallyState.fromJson((json['state'] as Map<String, dynamic>?) ?? const {}),
      );

  LiveMatch copyWith({RallyState? state, String? status, DateTime? startedAt}) => LiveMatch(
        matchPublicId: matchPublicId,
        status: status ?? this.status,
        startedAt: startedAt ?? this.startedAt,
        creatorNames: creatorNames,
        opponentNames: opponentNames,
        state: state ?? this.state,
      );

  String get creatorLabel => creatorNames.join(' / ');
  String get opponentLabel => opponentNames.join(' / ');
}
