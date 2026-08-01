import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:app/core/services/api_client.dart';

class PlayerProfile {
  final String name;
  final String mobileNumber;
  final String primarySport; // "Badminton" | "Box Cricket"

  // Badminton specifics
  final String? handPreference; // "Right-handed" | "Left-handed"
  final String? badmintonFormat; // "Singles" | "Doubles" | "Both"
  final String? skillLevel; // "Beginner" | "Intermediate" | "Advanced"

  // Cricket specifics
  final String?
  cricketRole; // "Batsman" | "Bowler" | "All-rounder" | "Wicket-keeper"
  final String? battingStyle; // "Right-hand bat" | "Left-hand bat"
  final String? bowlingStyle; // "Pace bowler" | "Spin bowler" | "None"
  final String? cricHeroesProfile; // CricHeroes username or ID

  final int eloRating;
  final String? accessToken;

  PlayerProfile({
    required this.name,
    required this.mobileNumber,
    required this.primarySport,
    this.handPreference,
    this.badmintonFormat,
    this.skillLevel,
    this.cricketRole,
    this.battingStyle,
    this.bowlingStyle,
    this.cricHeroesProfile,
    this.eloRating = 1200,
    this.accessToken,
  });

  PlayerProfile copyWith({
    String? name,
    String? mobileNumber,
    String? primarySport,
    String? handPreference,
    String? badmintonFormat,
    String? skillLevel,
    String? cricketRole,
    String? battingStyle,
    String? bowlingStyle,
    String? cricHeroesProfile,
    int? eloRating,
    String? accessToken,
  }) {
    return PlayerProfile(
      name: name ?? this.name,
      mobileNumber: mobileNumber ?? this.mobileNumber,
      primarySport: primarySport ?? this.primarySport,
      handPreference: handPreference ?? this.handPreference,
      badmintonFormat: badmintonFormat ?? this.badmintonFormat,
      skillLevel: skillLevel ?? this.skillLevel,
      cricketRole: cricketRole ?? this.cricketRole,
      battingStyle: battingStyle ?? this.battingStyle,
      bowlingStyle: bowlingStyle ?? this.bowlingStyle,
      cricHeroesProfile: cricHeroesProfile ?? this.cricHeroesProfile,
      eloRating: eloRating ?? this.eloRating,
      accessToken: accessToken ?? this.accessToken,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'mobileNumber': mobileNumber,
      'primarySport': primarySport,
      'handPreference': handPreference,
      'badmintonFormat': badmintonFormat,
      'skillLevel': skillLevel,
      'cricketRole': cricketRole,
      'battingStyle': battingStyle,
      'bowlingStyle': bowlingStyle,
      'cricHeroesProfile': cricHeroesProfile,
      'eloRating': eloRating,
      'accessToken': accessToken,
    };
  }

  factory PlayerProfile.fromJson(Map<String, dynamic> json) {
    return PlayerProfile(
      name: json['name'] as String,
      mobileNumber: json['mobileNumber'] as String,
      primarySport: json['primarySport'] as String,
      handPreference: json['handPreference'] as String?,
      badmintonFormat: json['badmintonFormat'] as String?,
      skillLevel: json['skillLevel'] as String?,
      cricketRole: json['cricketRole'] as String?,
      battingStyle: json['battingStyle'] as String?,
      bowlingStyle: json['bowlingStyle'] as String?,
      cricHeroesProfile: json['cricHeroesProfile'] as String?,
      eloRating: json['eloRating'] as int? ?? 1200,
      accessToken: json['accessToken'] as String?,
    );
  }
}

class ProfileNotifier extends Notifier<PlayerProfile?> {
  static PlayerProfile? inMemoryFallback;

  @override
  PlayerProfile? build() {
    _loadProfile();
    return null;
  }

  Future<void> _loadProfile() async {
    print('[ProfileProvider] _loadProfile starting...');
    try {
      await Future.delayed(const Duration(seconds: 2));

      final prefs = await SharedPreferences.getInstance();
      final jsonStr = prefs.getString('player_profile');
      print('[ProfileProvider] Loaded raw JSON: $jsonStr');
      if (jsonStr != null) {
        final decoded = json.decode(jsonStr) as Map<String, dynamic>;
        state = PlayerProfile.fromJson(decoded);
        inMemoryFallback = state;
        print('[ProfileProvider] State updated to profile: ${state?.name}');
        
        // Fetch fresh profile from backend
        Future.microtask(() => fetchProfile());
      } else {
        print('[ProfileProvider] No profile found in cache');
      }
    } catch (e) {
      print('[ProfileProvider] Error loading profile: $e. Falling back to in-memory store.');
      if (inMemoryFallback != null) {
        state = inMemoryFallback;
        print('[ProfileProvider] Restored profile from in-memory fallback: ${state?.name}');
      }
    } finally {
      ref.read(isProfileLoadingProvider.notifier).state = false;
      print('[ProfileProvider] isProfileLoading set to false');
    }
  }

  Future<void> fetchProfile() async {
    if (state == null || state?.accessToken == null) return;
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.get('/users/me');
      final data = response['data'] ?? response;

      final fullName = data['fullName'] as String? ?? '';
      final primarySportStr = data['primarySport'] as String? ?? 'Badminton';
      final primarySport = primarySportStr.toLowerCase() == 'badminton'
          ? 'Badminton'
          : (primarySportStr.toLowerCase().contains('cricket') ? 'Box Cricket' : 'Turf Football');
      final skillLevelStr = data['skillLevel'] as String? ?? 'intermediate';
      final skillLevel = skillLevelStr.toLowerCase() == 'beginner'
          ? 'Beginner'
          : (skillLevelStr.toLowerCase() == 'advanced' ? 'Advanced' : 'Intermediate');
      final eloRating = data['eloRating'] as int? ?? 1200;

      final updated = state!.copyWith(
        name: fullName.isNotEmpty ? fullName : state!.name,
        primarySport: primarySport,
        skillLevel: skillLevel,
        eloRating: eloRating,
      );
      state = updated;
      inMemoryFallback = updated;

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('player_profile', json.encode(updated.toJson()));
      print('[ProfileProvider] Profile updated from backend: fullName=$fullName, ELO=$eloRating');
    } catch (e) {
      print('[ProfileProvider] Failed to fetch profile from backend: $e');
    }
  }

  Future<void> registerPlayer(PlayerProfile profile) async {
    print('[ProfileProvider] registerPlayer: ${profile.name}');
    state = profile;
    inMemoryFallback = profile;
    try {
      final prefs = await SharedPreferences.getInstance();
      final jsonStr = json.encode(profile.toJson());
      print('[ProfileProvider] Saving profile to cache: $jsonStr');
      await prefs.setString('player_profile', jsonStr);

      if (profile.accessToken != null) {
        final client = ref.read(apiClientProvider);
        
        String backendSport = 'badminton';
        if (profile.primarySport.toLowerCase().contains('cricket')) {
          backendSport = 'cricket';
        } else if (profile.primarySport.toLowerCase().contains('football')) {
          backendSport = 'football';
        }

        String backendSkill = 'intermediate';
        if (profile.skillLevel?.toLowerCase().contains('beginner') == true) {
          backendSkill = 'beginner';
        } else if (profile.skillLevel?.toLowerCase().contains('advanced') == true) {
          backendSkill = 'advanced';
        }

        print('[ProfileProvider] Syncing new profile with backend: name=${profile.name} sport=$backendSport skill=$backendSkill');
        await client.patch('/users/me', {
          if (profile.name.isNotEmpty) 'fullName': profile.name,
          'primarySport': backendSport,
          'skillLevel': backendSkill,
          'homeAreaName': 'Gomti Nagar',
        });
      }
    } catch (e) {
      print('[ProfileProvider] Error saving/syncing profile: $e. Using in-memory fallback.');
    }
  }

  Future<void> updateElo(int newElo) async {
    if (state != null) {
      final updated = state!.copyWith(eloRating: newElo);
      state = updated;
      inMemoryFallback = updated;
      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('player_profile', json.encode(updated.toJson()));
      } catch (e) {
        // Ignore failed writes
      }
    }
  }

  Future<void> logout() async {
    state = null;
    inMemoryFallback = null;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove('player_profile');
    } catch (e) {
      print('[ProfileProvider] Error during logout SharedPreferences clear: $e');
    }
  }
}

final profileProvider = NotifierProvider<ProfileNotifier, PlayerProfile?>(
  ProfileNotifier.new,
);
final isProfileLoadingProvider = StateProvider<bool>((ref) => true);
