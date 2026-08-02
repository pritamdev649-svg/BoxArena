import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/features/auth/presentation/login_screen.dart';
import 'package:app/features/auth/presentation/registration_screen.dart';
import 'package:app/features/booking/presentation/arena_list_screen.dart';
import 'package:app/features/booking/presentation/arena_detail_screen.dart';
import 'package:app/features/matchmaking/presentation/challenges_screen.dart';
import 'package:app/features/wallet/presentation/wallet_screen.dart';
import 'package:app/features/profile/presentation/player_profile_screen.dart';
import 'package:app/features/profile/presentation/edit_profile_screen.dart';
import 'package:app/features/scoring/presentation/score_entry_screen.dart';
import 'package:app/features/matchmaking/presentation/create_challenge_screen.dart';
import 'package:app/core/providers/profile_provider.dart';
import 'package:app/core/widgets/app_loader.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/features/splash/presentation/splash_screen.dart';
import 'package:app/main.dart';
import 'package:app/features/scoring/presentation/live_scoring_screen.dart';
import 'package:app/features/scoring/presentation/official_matches_screen.dart';
import 'package:app/features/officials/presentation/register_official_screen.dart';
import 'package:app/features/officials/presentation/confirm_result_screen.dart';

// Notifier class that listens to Profile state shifts and notifies GoRouter
class RouterNotifier extends ChangeNotifier {
  RouterNotifier(Ref ref) {
    ref.listen<PlayerProfile?>(profileProvider, (_, __) {
      notifyListeners();
    });
    ref.listen<bool>(isProfileLoadingProvider, (_, __) {
      notifyListeners();
    });
  }
}

final routerNotifierProvider = Provider<RouterNotifier>((ref) => RouterNotifier(ref));

final routerProvider = Provider<GoRouter>((ref) {
  final routerNotifier = ref.watch(routerNotifierProvider);

  return GoRouter(
    initialLocation: '/',
    refreshListenable: routerNotifier,
    redirect: (context, state) {
      final isProfileLoading = ref.read(isProfileLoadingProvider);
      final location = state.matchedLocation;
      
      if (isProfileLoading) {
        print('[Router] redirect: profile loading, current location: $location. Redirecting to /');
        if (location != '/') {
          return '/';
        }
        return null;
      }

      final currentProfile = ref.read(profileProvider);
      final loggingIn = location == '/login';
      final registering = location == '/register';
      final splash = location == '/';

      print('[Router] redirect: location=$location, profile=${currentProfile?.name} (phone: ${currentProfile?.mobileNumber})');

      // 1. If player hasn't registered a profile, they must verify mobile & configure stats
      if (currentProfile == null) {
        if (!loggingIn && !registering) {
          print('[Router] redirect: profile is null and not logging in/registering. Redirecting to /login');
          return '/login';
        }
        print('[Router] redirect: profile is null, user is at $location. Staying.');
        return null;
      }

      // 2. If registered, route away from auth screens to the main discover dashboard
      if (loggingIn || registering || splash) {
        print('[Router] redirect: registered user at auth route $location. Redirecting to /discover');
        return '/discover';
      }

      print('[Router] redirect: staying at $location');
      return null;
    },
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) {
          final extra = state.extra as Map<String, dynamic>?;
          final phone = extra?['phone'] as String? ?? '9999999999';
          return RegistrationScreen(mobileNumber: phone);
        },
      ),
      ShellRoute(
        builder: (context, state, child) {
          return DashboardShell(child: child);
        },
        routes: [
          GoRoute(
            path: '/discover',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ArenaListScreen(),
            ),
          ),
          GoRoute(
            path: '/challenges',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ChallengesScreen(),
            ),
          ),
          GoRoute(
            path: '/wallet',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: WalletScreen(),
            ),
          ),
          GoRoute(
            path: '/profile',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: PlayerProfileScreen(),
            ),
          ),
        ],
      ),
      GoRoute(
        path: '/score/:matchId',
        builder: (context, state) =>
            LiveScoringScreen(matchId: state.pathParameters['matchId']!),
      ),
      GoRoute(
        path: '/officials/register',
        builder: (context, state) => const RegisterOfficialScreen(),
      ),
      GoRoute(
        path: '/matches/:matchId/confirm',
        builder: (context, state) =>
            ConfirmResultScreen(matchId: state.pathParameters['matchId']!),
      ),
      GoRoute(
        path: '/official/matches',
        builder: (context, state) => const OfficialMatchesScreen(),
      ),
      GoRoute(
        path: '/score-entry',
        builder: (context, state) => const ScoreEntryScreen(),
      ),
      GoRoute(
        path: '/create-challenge',
        builder: (context, state) => const CreateChallengeScreen(),
      ),
      GoRoute(
        path: '/edit-profile',
        builder: (context, state) => const EditProfileScreen(),
      ),
    ],
  );
});
