import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/widgets/app_loader.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppColors.bgBase,
              AppColors.bgSurface,
            ],
          ),
        ),
        child: SafeArea(
          child: Stack(
            children: [
              // Core branding branding elements in the center
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Brand Icon inside a glowing circle
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.bgElevated,
                        border: Border.all(
                          color: AppColors.voltGlow,
                          width: 2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.voltGlow.withAlpha(20),
                            blurRadius: 30,
                            spreadRadius: 10,
                          ),
                        ],
                      ),
                      child: Icon(
                        Icons.sports_tennis_rounded,
                        size: 72,
                        color: AppColors.volt500,
                      ),
                    ),
                    const SizedBox(height: 32),
                    // Main Title
                    Text(
                      'BOXARENA',
                      style: AppTheme.displayStyle(
                        fontSize: 36,
                        color: AppColors.textPrimary,
                      ).copyWith(
                        fontWeight: FontWeight.bold,
                        letterSpacing: 2.0,
                      ),
                    ),
                    const SizedBox(height: 8),
                    // Subtitle
                    Text(
                      'PLAY • MATCH • SCORE',
                      style: TextStyle(
                        fontSize: 12,
                        color: AppColors.volt500,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 4.0,
                      ),
                    ),
                  ],
                ),
              ),
              
              // App Loader placed nicely at the bottom
              Align(
                alignment: Alignment.bottomCenter,
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 64.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const AppLoader(),
                      const SizedBox(height: 16),
                      Text(
                        'Checking profile status...',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.textMuted,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
