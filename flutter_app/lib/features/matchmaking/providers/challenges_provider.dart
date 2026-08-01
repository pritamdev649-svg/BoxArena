import 'dart:developer';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/mock/seed_data.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/providers/profile_provider.dart';
import 'package:intl/intl.dart';

class ChallengesState {
  final List<MockChallenge> challenges;
  final bool isLoading;
  final String? errorMessage;

  ChallengesState({
    required this.challenges,
    this.isLoading = false,
    this.errorMessage,
  });

  ChallengesState copyWith({
    List<MockChallenge>? challenges,
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

      final challenges = data.map((json) {
        final publicId = json['publicId'] as String? ?? '';
        
        final creatorTeam = json['creatorTeamId'] as Map<String, dynamic>? ?? {};
        final creatorTeamName = creatorTeam['name'] as String? ?? 'Gomti Smashers';

        final creatorUser = json['creatorUserId'] as Map<String, dynamic>? ?? {};
        final creatorCaptainName = creatorUser['fullName'] as String? ?? 'Aman Tripathi';

        final sportStr = json['sport'] as String? ?? '';
        final sport = sportStr.toLowerCase() == 'badminton'
            ? 'Badminton'
            : (sportStr.toLowerCase().contains('cricket') ? 'Box Cricket' : 'Turf Football');

        final arena = json['arenaId'] as Map<String, dynamic>? ?? {};
        final arenaName = arena['name'] as String? ?? 'The Vibhuti Box Arena';

        final startAtStr = json['startAt'] as String? ?? '';
        DateTime? startAt;
        if (startAtStr.isNotEmpty) {
          startAt = DateTime.parse(startAtStr).toLocal();
        }
        
        final date = startAt != null
            ? (startAt.day == DateTime.now().day
                ? 'Today'
                : DateFormat('MMM dd, yyyy').format(startAt))
            : 'Today';

        final time = startAt != null
            ? DateFormat('hh:mm a').format(startAt)
            : '07:00 PM';

        final entryFeePaise = (json['entryFeePaise'] as num?)?.toInt() ?? 0;
        final prizePoolPaise = (json['prizePoolPaise'] as num?)?.toInt() ?? 0;
        
        final format = json['format'] as String? ?? 'Doubles (2v2)';
        final status = json['status'] as String? ?? 'open';

        return MockChallenge(
          publicId: publicId,
          creatorTeamName: creatorTeamName,
          creatorCaptainName: creatorCaptainName,
          sport: sport,
          arenaName: arenaName,
          date: date,
          time: time,
          entryFeePaise: entryFeePaise,
          prizePoolPaise: prizePoolPaise,
          skillLevel: 'intermediate',
          status: status,
          teamFormat: format,
        );
      }).toList();

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

  void createChallenge(MockChallenge challenge) {
    state = state.copyWith(challenges: [...state.challenges, challenge]);
  }
}

final challengesProvider = NotifierProvider<ChallengesNotifier, ChallengesState>(ChallengesNotifier.new);
