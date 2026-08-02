import 'dart:developer';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/models/challenge.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/providers/profile_provider.dart';

class ChallengesState {
  final List<Challenge> challenges;
  final bool isLoading;
  final String? errorMessage;

  ChallengesState({
    required this.challenges,
    this.isLoading = false,
    this.errorMessage,
  });

  ChallengesState copyWith({
    List<Challenge>? challenges,
    bool? isLoading,
    String? errorMessage,
  }) {
    return ChallengesState(
      challenges: challenges ?? this.challenges,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class ChallengesNotifier extends Notifier<ChallengesState> {
  @override
  ChallengesState build() {
    Future.microtask(() => loadChallenges());
    return ChallengesState(challenges: [], isLoading: true);
  }

  Future<void> loadChallenges() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.get(ApiRoutes.challenges);
      final List<dynamic> data = response['data'] ?? response;

      final challenges = data
          .map((json) => Challenge.fromJson(json as Map<String, dynamic>))
          .toList();

      state = ChallengesState(challenges: challenges, isLoading: false);
    } catch (e) {
      log('[ChallengesNotifier] Failed to load challenges: $e');
      state = ChallengesState(
        challenges: [],
        isLoading: false,
        errorMessage: e.toString(),
      );
    }
  }

  Future<void> refreshChallenges() async {
    state = state.copyWith(isLoading: true);
    await loadChallenges();
  }

  Future<bool> acceptChallenge(String publicId) async {
    try {
      final client = ref.read(apiClientProvider);
      final profile = ref.read(profileProvider);
      if (profile == null) {
        log('[ChallengesNotifier] Cannot accept challenge: profile is null');
        return false;
      }

      final teamsResponse = await client.get('/teams/mine');
      final List<dynamic> teamsList = teamsResponse['data'] ?? teamsResponse;
      
      String teamPublicId = '';
      if (teamsList.isNotEmpty) {
        teamPublicId = teamsList.first['publicId'] as String;
      } else {
        final challenge = state.challenges.firstWhere((c) => c.publicId == publicId);
        
        String backendSport = 'badminton';
        if (challenge.sport.toLowerCase().contains('cricket')) {
          backendSport = 'cricket';
        } else if (challenge.sport.toLowerCase().contains('football')) {
          backendSport = 'football';
        }

        String backendFormat = 'doubles';
        if (challenge.teamFormat?.toLowerCase().contains('singles') == true) {
          backendFormat = 'singles';
        } else if (challenge.teamFormat?.toLowerCase().contains('6v6') == true) {
          backendFormat = '6v6';
        }

        log('[ChallengesNotifier] Creating team dynamically for challenge: sport=$backendSport format=$backendFormat');
        final createTeamResponse = await client.post('/teams', {
          'name': "${profile.name}'s Team",
          'sport': backendSport,
          'format': backendFormat,
        });
        
        final newTeamData = createTeamResponse['data'] ?? createTeamResponse;
        teamPublicId = newTeamData['publicId'] as String;
      }

      log('[ChallengesNotifier] Accepting challenge: challengePublicId=$publicId teamPublicId=$teamPublicId');
      await client.post('/challenges/$publicId/accept', {
        'teamId': teamPublicId,
      });

      await loadChallenges();
      return true;
    } catch (e) {
      log('[ChallengesNotifier] Failed to accept challenge: $e');
      return false;
    }
  }

  /// Posting a challenge.
  ///
  /// Both ids are required by the API and both are publicIds. There is no
  /// longer a path where the server invents a booking for a court nobody
  /// reserved — if the booking does not exist, this fails loudly.
  Future<bool> createChallenge({
    required String bookingPublicId,
    required String teamPublicId,
    required int entryFeePaise,
    String? notes,
  }) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.post(ApiRoutes.challenges, {
        'bookingId': bookingPublicId,
        'teamId': teamPublicId,
        'entryFeePaise': entryFeePaise,
        if (notes != null && notes.isNotEmpty) 'notes': notes,
      });
      await loadChallenges();
      return true;
    } catch (e) {
      log('[ChallengesNotifier] Failed to create challenge: $e');
      return false;
    }
  }
}

final challengesProvider = NotifierProvider<ChallengesNotifier, ChallengesState>(ChallengesNotifier.new);
