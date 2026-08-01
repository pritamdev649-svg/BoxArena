import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/providers/profile_provider.dart';
import 'package:app/core/providers/theme_provider.dart';
import 'package:app/core/widgets/app_loader.dart';
import 'package:app/core/widgets/app_button.dart';

class PlayerProfileScreen extends ConsumerWidget {
  const PlayerProfileScreen({super.key});



  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final themeMode = ref.watch(themeProvider);

    if (profile == null) {
      return Scaffold(
        backgroundColor: AppColors.bgBase,
        body: const Center(child: AppLoader.medium),
      );
    }

    final displayName = profile.name == 'New Player' ? 'Guest' : profile.name;
    final isCricket = profile.primarySport == "Box Cricket";

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text('PLAYER PROFILE', style: AppTheme.displayStyle(fontSize: 18)),
        centerTitle: true,
        actions: [
          // Theme toggler button
          IconButton(
            icon: Icon(
              themeMode == ThemeMode.dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
              color: AppColors.volt500,
            ),
            onPressed: () {
              ref.read(themeProvider.notifier).toggleTheme();
            },
          ),
          IconButton(
            icon: Icon(Icons.edit_rounded, color: AppColors.volt500),
            onPressed: () {
              context.push('/edit-profile');
            },
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: AppColors.loss),
            onPressed: () {
              ref.read(profileProvider.notifier).logout();
            },
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(12.0), // Compact padding
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Avatar and ELO Card
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 16.0), // Compact padding
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(12), // Sleeker roundness
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 36, // Smaller compact radius
                    backgroundColor: AppColors.volt500,
                    child: Text(
                      displayName.isNotEmpty ? displayName.substring(0, 1).toUpperCase() : 'G',
                      style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black),
                    ),
                  ),
                  const SizedBox(height: 10), // Reduced height
                  Text(displayName, style: AppTheme.displayStyle(fontSize: 18)), // Thinner modern displayStyle
                  const SizedBox(height: 2), // Reduced height
                  Text('+91 ${profile.mobileNumber}', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  const SizedBox(height: 10), // Reduced height
                  
                  // Skill Rating Badge
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    decoration: BoxDecoration(
                      color: AppColors.bgInset,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.flash_on_rounded, color: AppColors.gold, size: 14),
                        const SizedBox(width: 4),
                        Text(
                          'ELO RATING: ${profile.eloRating}',
                          style: AppTheme.tabularStyle(fontSize: 12, fontWeight: FontWeight.bold),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12), // Reduced height

            // Sport details card
            Text(profile.primarySport.toUpperCase(), style: AppTheme.label),
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 14.0), // Compact padding
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                children: [
                  if (isCricket) ...[
                    _buildProfileRow('Player Role', profile.cricketRole ?? 'All-rounder', Icons.sports_cricket_rounded),
                    Divider(height: 20, color: AppColors.borderSubtle),
                    _buildProfileRow('Batting Hand', profile.battingStyle ?? 'Right-handed', Icons.back_hand_rounded),
                    Divider(height: 20, color: AppColors.borderSubtle),
                    _buildProfileRow('Bowling Type', profile.bowlingStyle ?? 'None', Icons.sports_baseball_rounded),
                    if (profile.cricHeroesProfile != null && profile.cricHeroesProfile!.isNotEmpty) ...[
                      Divider(height: 20, color: AppColors.borderSubtle),
                      _buildProfileRow('CricHeroes', '@${profile.cricHeroesProfile}', Icons.verified_rounded, valueColor: AppColors.win),
                    ],
                  ] else ...[
                    _buildProfileRow('Format Prefer', profile.badmintonFormat ?? 'Both', Icons.sports_tennis_rounded),
                    Divider(height: 20, color: AppColors.borderSubtle),
                    _buildProfileRow('Play Hand', profile.handPreference ?? 'Right-handed', Icons.back_hand_rounded),
                    Divider(height: 20, color: AppColors.borderSubtle),
                    _buildProfileRow('Skill Band', profile.skillLevel ?? 'Intermediate', Icons.bar_chart_rounded),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16), // Reduced height

            AppButton(
              label: 'CREATE QUICK CHALLENGE',
              onPressed: () => context.push('/create-challenge'),
              icon: Icons.add_box_rounded,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileRow(String label, String value, IconData icon, {Color? valueColor}) {
    return Row(
      children: [
        Icon(icon, color: AppColors.info, size: 18),
        const SizedBox(width: 10),
        Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            color: valueColor ?? AppColors.textPrimary,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
      ],
    );
  }
}
