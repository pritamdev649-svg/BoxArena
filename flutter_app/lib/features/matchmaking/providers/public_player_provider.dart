import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/models/player.dart';
import 'package:app/core/services/api_client.dart';

/// One player's public profile, by publicId.
///
/// Keyed by id rather than by name: two players can share a name, and a name
/// is not something the API can look anything up by.
final publicPlayerProvider =
    FutureProvider.autoDispose.family<PlayerProfile, String>((ref, publicId) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get(ApiRoutes.publicPlayer(publicId));
  return PlayerProfile.fromJson(
    (response['data'] ?? response) as Map<String, dynamic>,
  );
});
