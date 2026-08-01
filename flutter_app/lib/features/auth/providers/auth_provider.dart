import 'dart:convert';
import 'dart:developer';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:app/core/providers/profile_provider.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/constants/api_routes.dart';

class AuthState {
  final bool isOtpSent;
  final bool isLoading;
  final String? errorMessage;

  AuthState({
    this.isOtpSent = false,
    this.isLoading = false,
    this.errorMessage,
  });

  AuthState copyWith({
    bool? isOtpSent,
    bool? isLoading,
    String? errorMessage,
  }) {
    return AuthState(
      isOtpSent: isOtpSent ?? this.isOtpSent,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    return AuthState();
  }

  Future<bool> sendOtp(String mobileNumber) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final formattedPhone = '+91$mobileNumber';
      final client = ref.read(apiClientProvider);
      await client.post(ApiRoutes.otpRequest, {'phoneNumber': formattedPhone});
      
      state = state.copyWith(isLoading: false, isOtpSent: true);
      return true;
    } catch (e) {
      final cleanMsg = e.toString().replaceAll('Exception: ', '');
      state = state.copyWith(isLoading: false, errorMessage: cleanMsg);
      return false;
    }
  }

  Future<bool> verifyOtp(String mobileNumber, String code) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final formattedPhone = '+91$mobileNumber';
      final client = ref.read(apiClientProvider);
      
      final response = await client.post(ApiRoutes.otpVerify, {
        'phoneNumber': formattedPhone,
        'code': code,
      });

      final accessToken = response['data']?['accessToken'] as String?;
      if (accessToken == null) {
        throw Exception('Access token not returned by backend');
      }

      // Check if there is an existing profile in cache
      PlayerProfile? savedProfile;
      try {
        final prefs = await SharedPreferences.getInstance();
        final jsonStr = prefs.getString('player_profile');
        if (jsonStr != null) {
          final decoded = json.decode(jsonStr) as Map<String, dynamic>;
          savedProfile = PlayerProfile.fromJson(decoded);
        }
      } catch (e) {
        log('Error reading profile from cache: $e');
      }

      savedProfile ??= ProfileNotifier.inMemoryFallback;

      if (savedProfile != null && savedProfile.mobileNumber == mobileNumber) {
        final updatedProfile = savedProfile.copyWith(accessToken: accessToken);
        await ref.read(profileProvider.notifier).registerPlayer(updatedProfile);
        state = state.copyWith(isLoading: false);
        return true; // Indicate direct login complete
      }

      // New profile setup
      final newProfile = PlayerProfile(
        name: '',
        mobileNumber: mobileNumber,
        primarySport: '',
        accessToken: accessToken,
      );
      await ref.read(profileProvider.notifier).registerPlayer(newProfile);

      state = state.copyWith(isLoading: false);
      return false; // Indicate need redirect to registration
    } catch (e) {
      final cleanMsg = e.toString().replaceAll('Exception: ', '');
      state = state.copyWith(isLoading: false, errorMessage: cleanMsg);
      return false;
    }
  }
}

final authControllerProvider = NotifierProvider.autoDispose<AuthNotifier, AuthState>(AuthNotifier.new);
