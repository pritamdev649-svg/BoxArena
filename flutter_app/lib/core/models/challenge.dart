import 'package:intl/intl.dart';

/// An open or matched challenge — `GET /challenges`.
///
/// Deliberately keeps the raw `startAt` instead of pre-formatted date and time
/// strings: a widget that receives `'Today'` and `'07:00 PM'` cannot tell you
/// whether the match has already started.
class Challenge {
  final String publicId;
  final String creatorTeamName;
  final String creatorCaptainName;

  /// The captain's publicId, so their real profile can be fetched. Empty when
  /// the API did not populate it.
  final String creatorCaptainPublicId;

  final String sport;
  final String arenaName;
  final DateTime? startAt;
  final int entryFeePaise;
  final int prizePoolPaise;
  final String? skillLevel;
  final String status;
  final String? teamFormat;

  const Challenge({
    required this.publicId,
    required this.creatorTeamName,
    required this.creatorCaptainName,
    required this.sport,
    required this.arenaName,
    required this.entryFeePaise,
    required this.prizePoolPaise,
    required this.status,
    this.creatorCaptainPublicId = '',
    this.startAt,
    this.skillLevel,
    this.teamFormat,
  });

  bool get isOpen => status == 'open';

  String get dateLabel {
    if (startAt == null) return '—';
    final now = DateTime.now();
    final isToday = startAt!.year == now.year &&
        startAt!.month == now.month &&
        startAt!.day == now.day;
    return isToday ? 'Today' : DateFormat('MMM dd, yyyy').format(startAt!);
  }

  String get timeLabel =>
      startAt == null ? '—' : DateFormat('hh:mm a').format(startAt!);

  static String labelForSport(String raw) {
    switch (raw.toLowerCase()) {
      case 'badminton':
        return 'Badminton';
      case 'cricket':
        return 'Box Cricket';
      case 'football':
        return 'Turf Football';
      default:
        return raw;
    }
  }

  factory Challenge.fromJson(Map<String, dynamic> json) {
    final team = json['creatorTeamId'] as Map<String, dynamic>? ?? const {};
    final captain = json['creatorUserId'] as Map<String, dynamic>? ?? const {};
    final arena = json['arenaId'] as Map<String, dynamic>? ?? const {};
    final startRaw = json['startAt'] as String?;

    return Challenge(
      publicId: json['publicId'] as String? ?? '',
      /// No invented fallbacks: an unnamed team shows as unnamed, so a data
      /// problem is visible instead of being papered over with a plausible
      /// Lucknow team name.
      creatorTeamName: team['name'] as String? ?? 'Team',
      creatorCaptainName: captain['fullName'] as String? ?? 'Captain',
      creatorCaptainPublicId: captain['publicId'] as String? ?? '',
      sport: labelForSport(json['sport'] as String? ?? ''),
      arenaName: arena['name'] as String? ?? 'Venue',
      startAt: startRaw == null || startRaw.isEmpty
          ? null
          : DateTime.parse(startRaw).toLocal(),
      entryFeePaise: (json['entryFeePaise'] as num?)?.toInt() ?? 0,
      prizePoolPaise: (json['prizePoolPaise'] as num?)?.toInt() ?? 0,
      skillLevel: json['skillLevel'] as String?,
      status: json['status'] as String? ?? 'open',
      teamFormat: json['format'] as String?,
    );
  }
}
