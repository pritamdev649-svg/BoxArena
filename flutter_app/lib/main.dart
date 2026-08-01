import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:app/core/navigation/app_router.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/services/firebase_service.dart';
import 'package:app/core/providers/locale_provider.dart';

import 'package:app/core/providers/theme_provider.dart';
import 'package:app/core/localization/app_localizations.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Preload translation JSON files dynamically
  await AppLocalizations.preloadAll();

  // Set preferred orientation to portrait
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  // Set system navigation/status bar styles to match theme
  SystemChrome.setSystemUIOverlayStyle(
    SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.bgSurface,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize Firebase and Cloud Messaging
  final firebaseService = FirebaseService();
  try {
    await firebaseService.init();
  } catch (e) {
    debugPrint(
      'Firebase init failed (expected in local builds without configs): $e',
    );
  }

  // Wrap the application in ProviderScope to enable Riverpod state management
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeProvider);
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'BoxArena',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,
      routerConfig: router,
    );
  }
}

class DashboardShell extends ConsumerStatefulWidget {
  final Widget child;

  const DashboardShell({super.key, required this.child});

  @override
  ConsumerState<DashboardShell> createState() => _DashboardShellState();
}

class _DashboardShellState extends ConsumerState<DashboardShell> {
  int _getCurrentIndex(BuildContext context) {
    final String location = GoRouterState.of(context).matchedLocation;
    if (location.startsWith('/discover')) return 0;
    if (location.startsWith('/challenges')) return 1;
    if (location.startsWith('/wallet')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0;
  }

  void _onTabTapped(BuildContext context, int index) {
    switch (index) {
      case 0:
        context.go('/discover');
        break;
      case 1:
        context.go('/challenges');
        break;
      case 2:
        context.go('/wallet');
        break;
      case 3:
        context.go('/profile');
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = ref.watch(l10nProvider);
    final currentIndex = _getCurrentIndex(context);

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      body: widget.child,
      bottomNavigationBar: Theme(
        data: Theme.of(context).copyWith(
          splashColor: Colors.transparent,
          highlightColor: Colors.transparent,
        ),
        child: BottomNavigationBar(
          currentIndex: currentIndex,
          onTap: (index) => _onTabTapped(context, index),
          type: BottomNavigationBarType.fixed,
          backgroundColor: AppColors.bgSurface,
          selectedItemColor: AppColors.volt500,
          unselectedItemColor: AppColors.textMuted,
          selectedLabelStyle: TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 11,
          ),
          unselectedLabelStyle: TextStyle(fontSize: 11),
          elevation: 0,
          items: [
            BottomNavigationBarItem(
              icon: Icon(Icons.explore_rounded),
              activeIcon: Icon(Icons.explore_rounded, color: AppColors.volt500),
              label: l10n.tabDiscover,
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.sports_esports_rounded),
              activeIcon: Icon(
                Icons.sports_esports_rounded,
                color: AppColors.volt500,
              ),
              label: l10n.tabChallenges,
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.account_balance_wallet_rounded),
              activeIcon: Icon(
                Icons.account_balance_wallet_rounded,
                color: AppColors.volt500,
              ),
              label: l10n.tabWallet,
            ),
            BottomNavigationBarItem(
              icon: Icon(Icons.person_rounded),
              activeIcon: Icon(Icons.person_rounded, color: AppColors.volt500),
              label: l10n.tabProfile,
            ),
          ],
        ),
      ),
    );
  }
}
