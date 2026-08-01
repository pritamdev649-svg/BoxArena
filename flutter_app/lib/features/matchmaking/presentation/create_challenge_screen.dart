import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/mock/seed_data.dart';
import 'package:app/core/providers/profile_provider.dart';
import 'package:app/features/matchmaking/providers/challenges_provider.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/widgets/app_input_field.dart';
import 'package:app/core/utils/app_snackbar.dart';

class CreateChallengeScreen extends ConsumerStatefulWidget {
  const CreateChallengeScreen({super.key});

  @override
  ConsumerState<CreateChallengeScreen> createState() => _CreateChallengeScreenState();
}

class _CreateChallengeScreenState extends ConsumerState<CreateChallengeScreen> {
  final _nameController = TextEditingController();
  final _entryFeeController = TextEditingController(text: '100');
  final _playerSearchController = TextEditingController();

  String _selectedSport = "Badminton";
  String _selectedFormat = "Doubles (2v2)";
  String _selectedSkill = "intermediate";
  String _selectedVenue = SeedData.arenas.first.name;
  String _selectedTime = "07:00 PM";
  String _selectedDateStr = "Today";

  // Track teammate status: Player Name -> "Pending" | "Joined"
  final Map<String, String> _squadInvites = {};
  List<MockPlayer> _searchResults = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final profile = ref.read(profileProvider);
      if (profile != null) {
        _nameController.text = "${profile.name}'s Match";
        _selectedSport = profile.primarySport;
        _selectedFormat = profile.primarySport.toLowerCase().contains('cricket') ? '6v6' : 'Doubles (2v2)';
        // Host automatically joined
        setState(() {
          _squadInvites[profile.name] = "Joined";
        });
      }
    });

    _playerSearchController.addListener(_onSearchChanged);
  }

  @override
  void dispose() {
    _nameController.dispose();
    _entryFeeController.dispose();
    _playerSearchController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = _playerSearchController.text.trim().toLowerCase();
    if (query.isEmpty) {
      setState(() => _searchResults = []);
      return;
    }

    setState(() {
      _searchResults = SeedData.players.where((player) {
        return player.fullName.toLowerCase().contains(query) &&
            !_squadInvites.containsKey(player.fullName);
      }).toList();
    });
  }

  void _invitePlayer(String name) {
    setState(() {
      _squadInvites[name] = "Pending";
      _playerSearchController.clear();
      _searchResults = [];
    });
    AppSnackBar.showInfo(context, 'Invitation sent to $name. Status: PENDING');
  }

  void _acceptInvite(String name) {
    setState(() {
      _squadInvites[name] = "Joined";
    });
    AppSnackBar.showSuccess(context, '$name accepted invitation and JOINED your squad!');
  }

  void _removePlayer(String name) {
    final profile = ref.read(profileProvider);
    if (profile != null && name == profile.name) {
      AppSnackBar.showError(context, 'You cannot remove yourself (Captain) from the squad.');
      return;
    }
    setState(() {
      _squadInvites.remove(name);
    });
  }

  Future<void> _publishChallenge() async {
    final profile = ref.read(profileProvider);
    if (profile == null) return;

    final matchName = _nameController.text.trim();
    if (matchName.isEmpty) {
      AppSnackBar.showError(context, 'Please enter a Challenge Name');
      return;
    }

    final fee = int.tryParse(_entryFeeController.text) ?? 100;

    // Filter only joined squad members
    final finalSquad = _squadInvites.entries
        .where((e) => e.value == "Joined")
        .map((e) => e.key)
        .toList();

    final newChallenge = MockChallenge(
      publicId: 'chal-${DateTime.now().millisecondsSinceEpoch}',
      creatorTeamName: matchName,
      creatorCaptainName: profile.name,
      sport: _selectedSport,
      arenaName: _selectedVenue,
      date: _selectedDateStr,
      time: _selectedTime,
      entryFeePaise: fee * 100,
      prizePoolPaise: (fee * 2 * 0.9).toInt() * 100,
      skillLevel: _selectedSkill,
      status: 'open',
      squadPlayers: finalSquad,
      teamFormat: _selectedFormat,
    );

    // Show loading overlay
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => Center(
        child: CircularProgressIndicator(color: AppColors.volt500),
      ),
    );

    final success = await ref.read(challengesProvider.notifier).createChallenge(newChallenge);

    if (mounted) {
      Navigator.pop(context); // Dismiss loading dialog
      if (success) {
        AppSnackBar.showSuccess(context, 'Match Challenge Published Successfully!');
        Navigator.pop(context); // Close create screen
      } else {
        AppSnackBar.showError(context, 'Failed to publish challenge. Please check your connection or wallet balance.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isCricket = _selectedSport.toLowerCase().contains('cricket');
    final formats = isCricket 
        ? ['2v2', '6v6', '8v8', '11v11'] 
        : ['Singles (1v1)', 'Doubles (2v2)'];

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text('CREATE A CHALLENGE', style: AppTheme.displayStyle(fontSize: 16)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Section 1: Basic Settings
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('CHALLENGE PROFILE', style: AppTheme.label),
                  const SizedBox(height: 12),
                  AppInputField(
                    controller: _nameController,
                    hintText: 'Match/Challenge Name',
                  ),
                  const SizedBox(height: 16),
                  
                  // Sport Selection
                  Text('Select Sport:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8.0,
                    runSpacing: 8.0,
                    children: ["Badminton", "Box Cricket", "Turf Football"].map((sport) {
                      final isSel = _selectedSport == sport;
                      return ChoiceChip(
                        label: Text(sport),
                        selected: isSel,
                        showCheckmark: false,
                        onSelected: (selected) {
                          if (selected) {
                            setState(() {
                              _selectedSport = sport;
                              _selectedFormat = sport.toLowerCase().contains('cricket') ? '6v6' : 'Doubles (2v2)';
                            });
                          }
                        },
                        selectedColor: AppColors.volt500,
                        backgroundColor: AppColors.bgInset,
                        labelStyle: TextStyle(
                          color: isSel ? Colors.black : AppColors.textSecondary,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                          side: BorderSide(color: isSel ? AppColors.volt500 : AppColors.borderSubtle),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 16),

                  // Format & Skill Selectors
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Format:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: AppColors.bgInset,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.borderSubtle),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedFormat,
                                  isExpanded: true,
                                  dropdownColor: AppColors.bgElevated,
                                  style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                                  items: formats.map((fmt) {
                                    return DropdownMenuItem(value: fmt, child: Text(fmt));
                                  }).toList(),
                                  onChanged: (val) {
                                    if (val != null) setState(() => _selectedFormat = val);
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Min Skill Required:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: AppColors.bgInset,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.borderSubtle),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedSkill,
                                  isExpanded: true,
                                  dropdownColor: AppColors.bgElevated,
                                  style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                                  items: ['beginner', 'intermediate', 'advanced'].map((lvl) {
                                    return DropdownMenuItem(value: lvl, child: Text(lvl.toUpperCase()));
                                  }).toList(),
                                  onChanged: (val) {
                                    if (val != null) setState(() => _selectedSkill = val);
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Section 2: Venue & Booking Specifics
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('VENUE & BOOKING SPECIFICS', style: AppTheme.label),
                  const SizedBox(height: 12),
                  
                  // Venue Selection
                  Text('Venue / Arena:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10),
                    decoration: BoxDecoration(
                      color: AppColors.bgInset,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: AppColors.borderSubtle),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedVenue,
                        isExpanded: true,
                        dropdownColor: AppColors.bgElevated,
                        style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                        items: SeedData.arenas.map((a) {
                          return DropdownMenuItem(value: a.name, child: Text(a.name));
                        }).toList(),
                        onChanged: (val) {
                          if (val != null) setState(() => _selectedVenue = val);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Schedule Slots
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Date:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: AppColors.bgInset,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.borderSubtle),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedDateStr,
                                  isExpanded: true,
                                  dropdownColor: AppColors.bgElevated,
                                  style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                                  items: ['Today', 'Tomorrow', 'Next Day'].map((d) {
                                    return DropdownMenuItem(value: d, child: Text(d));
                                  }).toList(),
                                  onChanged: (val) {
                                    if (val != null) setState(() => _selectedDateStr = val);
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Time Slot:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10),
                              decoration: BoxDecoration(
                                color: AppColors.bgInset,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.borderSubtle),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  value: _selectedTime,
                                  isExpanded: true,
                                  dropdownColor: AppColors.bgElevated,
                                  style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                                  items: ['06:00 PM', '07:00 PM', '08:00 PM', '09:00 PM'].map((t) {
                                    return DropdownMenuItem(value: t, child: Text(t));
                                  }).toList(),
                                  onChanged: (val) {
                                    if (val != null) setState(() => _selectedTime = val);
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Entry Fee
                  AppInputField(
                    controller: _entryFeeController,
                    hintText: 'Entry Fee (₹)',
                    keyboardType: TextInputType.number,
                    prefixText: '₹ ',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Section 3: Teammate Squad builder & Inviter
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text('BUILD YOUR SQUAD', style: AppTheme.label),
                  const SizedBox(height: 4),
                  Text(
                    'Search local players to invite. Simulation: tap check icon to Mock Accept.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                  ),
                  const SizedBox(height: 12),
                  
                  // Search Box
                  TextField(
                    controller: _playerSearchController,
                    decoration: InputDecoration(
                      hintText: 'Search player by profile name...',
                      prefixIcon: Icon(Icons.search_rounded, color: AppColors.textMuted, size: 20),
                      fillColor: AppColors.bgInset,
                      hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 12),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                    ),
                    style: TextStyle(color: AppColors.textPrimary, fontSize: 13),
                  ),

                  // Search Results
                  if (_searchResults.isNotEmpty)
                    Container(
                      margin: const EdgeInsets.only(top: 4),
                      decoration: BoxDecoration(
                        color: AppColors.bgElevated,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: AppColors.borderSubtle),
                      ),
                      constraints: const BoxConstraints(maxHeight: 180),
                      child: ListView.builder(
                        shrinkWrap: true,
                        itemCount: _searchResults.length,
                        itemBuilder: (context, index) {
                          final player = _searchResults[index];
                          return ListTile(
                            dense: true,
                            title: Text(player.fullName, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text('ELO: ${player.eloRating} • ${player.primarySport}'),
                            trailing: ElevatedButton(
                              onPressed: () => _invitePlayer(player.fullName),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.volt500,
                                foregroundColor: Colors.black,
                                visualDensity: VisualDensity.compact,
                              ),
                              child: const Text('INVITE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ),
                          );
                        },
                      ),
                    ),
                  
                  const SizedBox(height: 16),
                  Text('SQUAD LIST:', style: TextStyle(color: AppColors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 8),

                  // List of invited teammates with pending/joined status toggler
                  Column(
                    children: _squadInvites.entries.map((entry) {
                      final name = entry.key;
                      final status = entry.value;
                      final isPending = status == "Pending";

                      return Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: AppColors.bgInset,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.borderSubtle),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  isPending ? Icons.hourglass_top_rounded : Icons.check_circle_rounded,
                                  size: 16,
                                  color: isPending ? AppColors.dispute : AppColors.win,
                                ),
                                const SizedBox(width: 8),
                                Text(name, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: isPending ? AppColors.dispute.withOpacity(0.15) : AppColors.win.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    status.toUpperCase(),
                                    style: TextStyle(
                                      color: isPending ? AppColors.dispute : AppColors.win,
                                      fontSize: 8,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            Row(
                              children: [
                                if (isPending)
                                  IconButton(
                                    icon: const Icon(Icons.check_circle_outline_rounded, color: AppColors.win, size: 20),
                                    tooltip: 'Accept invitation (Mock)',
                                    onPressed: () => _acceptInvite(name),
                                    constraints: const BoxConstraints(),
                                    padding: EdgeInsets.zero,
                                  ),
                                const SizedBox(width: 8),
                                IconButton(
                                  icon: const Icon(Icons.delete_rounded, color: AppColors.loss, size: 18),
                                  onPressed: () => _removePlayer(name),
                                  constraints: const BoxConstraints(),
                                  padding: EdgeInsets.zero,
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 36),

            // Create Button
            AppButton(
              label: 'PUBLISH CHALLENGE',
              onPressed: _publishChallenge,
            ),
          ],
        ),
      ),
    );
  }
}
