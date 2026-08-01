import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/providers/profile_provider.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/widgets/app_input_field.dart';
import 'package:app/core/widgets/app_dropdown.dart';
import 'package:app/core/utils/app_snackbar.dart';

class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final TextEditingController _nameController = TextEditingController();
  final TextEditingController _cricHeroesController = TextEditingController();

  String _primarySport = "Badminton";

  // Badminton defaults
  String _handPreference = "Right-handed";
  String _badmintonFormat = "Singles";
  String _skillLevel = "Intermediate";

  // Cricket defaults
  String _cricketRole = "Batsman";
  String _battingStyle = "Right-hand bat";
  String _bowlingStyle = "Pace bowler";

  @override
  void initState() {
    super.initState();
    // Pre-populate fields with existing profile data
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final profile = ref.read(profileProvider);
      if (profile != null) {
        setState(() {
          _nameController.text = profile.name == 'New Player' ? '' : profile.name;
          _primarySport = profile.primarySport;
          
          if (profile.primarySport == "Badminton") {
            _handPreference = profile.handPreference ?? "Right-handed";
            _badmintonFormat = profile.badmintonFormat ?? "Singles";
            _skillLevel = profile.skillLevel ?? "Intermediate";
          } else if (profile.primarySport == "Box Cricket") {
            _cricketRole = profile.cricketRole ?? "Batsman";
            _battingStyle = profile.battingStyle ?? "Right-hand bat";
            _bowlingStyle = profile.bowlingStyle ?? "Pace bowler";
            _cricHeroesController.text = profile.cricHeroesProfile ?? "";
          }
        });
      }
    });
  }

  void _saveProfile() {
    final name = _nameController.text.trim();
    if (name.isEmpty) {
      AppSnackBar.showError(context, 'Please enter your full name');
      return;
    }

    final currentProfile = ref.read(profileProvider);
    if (currentProfile == null) return;

    final updatedProfile = PlayerProfile(
      name: name,
      mobileNumber: currentProfile.mobileNumber,
      primarySport: _primarySport,
      handPreference: _primarySport == "Badminton" ? _handPreference : null,
      badmintonFormat: _primarySport == "Badminton" ? _badmintonFormat : null,
      skillLevel: _primarySport == "Badminton" ? _skillLevel : null,
      cricketRole: _primarySport == "Box Cricket" ? _cricketRole : null,
      battingStyle: _primarySport == "Box Cricket" ? _battingStyle : null,
      bowlingStyle: _primarySport == "Box Cricket" ? _bowlingStyle : null,
      cricHeroesProfile: _primarySport == "Box Cricket" ? _cricHeroesController.text.trim() : null,
      eloRating: currentProfile.eloRating,
      accessToken: currentProfile.accessToken,
    );

    ref.read(profileProvider.notifier).registerPlayer(updatedProfile);
    AppSnackBar.showSuccess(context, 'Profile updated successfully!');
    context.pop();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _cricHeroesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text('EDIT PROFILE', style: AppTheme.displayStyle(fontSize: 18)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('EDIT YOUR PROFILE DETAILS', style: AppTheme.displayStyle(fontSize: 20)),
            const SizedBox(height: 8),
            Text(
              'Update your name, sport preferences, and playing level.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 24),

            // Full Name
            AppInputField(
              controller: _nameController,
              hintText: 'Full Name (e.g. Arjun Dev)',
              prefixIcon: Icons.person_rounded,
            ),
            const SizedBox(height: 20),

            // Select Sport Header
            Text('PRIMARY SPORT', style: AppTheme.label),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Badminton'),
                    selected: _primarySport == "Badminton",
                    selectedColor: AppColors.volt500,
                    backgroundColor: AppColors.bgSurface,
                    labelStyle: TextStyle(
                      color: _primarySport == "Badminton" ? AppColors.textInverse : AppColors.textSecondary,
                      fontWeight: FontWeight.bold,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    onSelected: (val) {
                      if (val) setState(() => _primarySport = "Badminton");
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ChoiceChip(
                    label: const Text('Box Cricket'),
                    selected: _primarySport == "Box Cricket",
                    selectedColor: AppColors.volt500,
                    backgroundColor: AppColors.bgSurface,
                    labelStyle: TextStyle(
                      color: _primarySport == "Box Cricket" ? AppColors.textInverse : AppColors.textSecondary,
                      fontWeight: FontWeight.bold,
                    ),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    onSelected: (val) {
                      if (val) setState(() => _primarySport = "Box Cricket");
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),

            Divider(color: AppColors.borderSubtle),
            const SizedBox(height: 16),

            // Dynamic forms based on selection
            if (_primarySport == "Badminton") ...[
              AppDropdown<String>(
                label: 'HAND PREFERENCE',
                value: _handPreference,
                items: const ['Right-handed', 'Left-handed'],
                itemLabelMapper: (val) => val,
                onChanged: (val) => setState(() => _handPreference = val!),
              ),
              const SizedBox(height: 16),
              AppDropdown<String>(
                label: 'PLAY FORMAT',
                value: _badmintonFormat,
                items: const ['Singles', 'Doubles', 'Both'],
                itemLabelMapper: (val) => val,
                onChanged: (val) => setState(() => _badmintonFormat = val!),
              ),
              const SizedBox(height: 16),
              AppDropdown<String>(
                label: 'SKILL LEVEL',
                value: _skillLevel,
                items: const ['Beginner', 'Intermediate', 'Advanced'],
                itemLabelMapper: (val) => val,
                onChanged: (val) => setState(() => _skillLevel = val!),
              ),
            ] else ...[
              AppDropdown<String>(
                label: 'PLAYER ROLE',
                value: _cricketRole,
                items: const ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'],
                itemLabelMapper: (val) => val,
                onChanged: (val) => setState(() => _cricketRole = val!),
              ),
              const SizedBox(height: 16),
              AppDropdown<String>(
                label: 'BATTING STYLE',
                value: _battingStyle,
                items: const ['Right-hand bat', 'Left-hand bat'],
                itemLabelMapper: (val) => val,
                onChanged: (val) => setState(() => _battingStyle = val!),
              ),
              const SizedBox(height: 16),
              AppDropdown<String>(
                label: 'BOWLING STYLE',
                value: _bowlingStyle,
                items: const ['Pace bowler', 'Spin bowler', 'None'],
                itemLabelMapper: (val) => val,
                onChanged: (val) => setState(() => _bowlingStyle = val!),
              ),
              const SizedBox(height: 20),
              AppInputField(
                controller: _cricHeroesController,
                hintText: 'CricHeroes Profile Username (Optional)',
                prefixIcon: Icons.stars_rounded,
              ),
            ],

            const SizedBox(height: 36),

            AppButton(
              label: 'SAVE CHANGES',
              onPressed: _saveProfile,
            ),
          ],
        ),
      ),
    );
  }
}
