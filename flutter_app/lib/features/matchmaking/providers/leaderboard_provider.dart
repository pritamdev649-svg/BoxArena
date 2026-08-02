import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/models/leaderboard_row.dart';
import 'package:app/core/services/api_client.dart';

/// The real ladder.
///
/// Badminton singles by default, because that is the only sport a challenge
/// can currently be posted in — a ladder for a sport nobody can compete in
/// would be decoration.
final leaderboardProvider =
    FutureProvider.autoDispose<List<LeaderboardRow>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response =
      await client.get(ApiRoutes.leaderboard('badminton', 'singles'));
  final List<dynamic> data = response['data'] ?? response;
  return data
      .map((json) => LeaderboardRow.fromJson(json as Map<String, dynamic>))
      .toList();
});
