import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/services/api_client.dart';

/// A team the player captains or plays for — `GET /teams/mine`.
class MyTeam {
  final String publicId;
  final String name;
  final String sport;
  final String format;

  const MyTeam({
    required this.publicId,
    required this.name,
    required this.sport,
    required this.format,
  });

  factory MyTeam.fromJson(Map<String, dynamic> json) => MyTeam(
        publicId: json['publicId'] as String? ?? '',
        name: json['name'] as String? ?? 'Team',
        sport: json['sport'] as String? ?? '',
        format: json['format'] as String? ?? '',
      );
}

final myTeamsProvider = FutureProvider.autoDispose<List<MyTeam>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get(ApiRoutes.myTeams);
  final List<dynamic> data = response['data'] ?? response;
  return data
      .map((json) => MyTeam.fromJson(json as Map<String, dynamic>))
      .toList();
});

/// Creating a team inline, so a player who has never made one is not dead-ended
/// on the challenge form.
Future<MyTeam> createTeam(
  WidgetRef ref, {
  required String name,
  required String sport,
  required String format,
}) async {
  final client = ref.read(apiClientProvider);
  final response = await client.post(ApiRoutes.teams, {
    'name': name,
    'sport': sport,
    'format': format,
  });
  return MyTeam.fromJson(
    (response['data'] ?? response) as Map<String, dynamic>,
  );
}
