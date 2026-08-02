import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/models/arena.dart';
import 'package:app/core/services/api_client.dart';

/// Venue statistics, counted server-side from real bookings and settled
/// matches. The screen used to derive these from `arena.name.hashCode`, which
/// produced a stable-looking number that meant nothing.
final arenaStatsProvider =
    FutureProvider.autoDispose.family<ArenaStats, String>((ref, publicId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get(ApiRoutes.arenaStats(publicId));
  return ArenaStats.fromJson(
    (response['data'] ?? response) as Map<String, dynamic>,
  );
});

/// Matches actually played here.
final arenaMatchesProvider = FutureProvider.autoDispose
    .family<List<ArenaMatch>, String>((ref, publicId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get(ApiRoutes.arenaMatches(publicId));
  final List<dynamic> data = response['data'] ?? response;
  return data
      .map((json) => ArenaMatch.fromJson(json as Map<String, dynamic>))
      .toList();
});
