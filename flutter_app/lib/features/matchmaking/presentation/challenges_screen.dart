import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/mock/seed_data.dart';
import 'package:app/features/wallet/providers/wallet_provider.dart';
import 'package:app/features/matchmaking/providers/challenges_provider.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/providers/locale_provider.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'challenge_detail_screen.dart';

class HostPlayerDetails {
  final String name;
  final String sport;
  final String skillLevel;
  final int elo;
  final int matchesPlayed;
  final int matchesWon;
  final String preference1;
  final String preference2;
  final String? cricHeroes;

  HostPlayerDetails({
    required this.name,
    required this.sport,
    required this.skillLevel,
    required this.elo,
    required this.matchesPlayed,
    required this.matchesWon,
    required this.preference1,
    required this.preference2,
    this.cricHeroes,
  });
}

class ChallengesScreen extends ConsumerStatefulWidget {
  const ChallengesScreen({super.key});

  @override
  ConsumerState<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends ConsumerState<ChallengesScreen> {
  String _selectedSport = "All";
  final List<String> _sports = ["All", "Badminton", "Box Cricket", "Turf Football"];

  HostPlayerDetails _getMockHostDetails(String name, String sport, String skillLevel) {
    final isCricket = sport.toLowerCase().contains('cricket');
    final matches = (name.length * 7) % 35 + 15;
    final won = (matches * 0.62).toInt();
    
    return HostPlayerDetails(
      name: name,
      sport: sport,
      skillLevel: skillLevel,
      elo: 1100 + (name.length * 15) % 350,
      matchesPlayed: matches,
      matchesWon: won,
      preference1: isCricket ? "Right-hand bat" : "Right-handed",
      preference2: isCricket ? "Spin bowler" : "Both formats",
      cricHeroes: isCricket ? name.toLowerCase().replaceAll(' ', '_') : null,
    );
  }



  void _showHostProfileBottomSheet(BuildContext context, MockChallenge challenge) {
    final details = _getMockHostDetails(challenge.creatorCaptainName, challenge.sport, challenge.skillLevel);
    
    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
        final winRate = ((details.matchesWon / details.matchesPlayed) * 100).toStringAsFixed(0);
        final isCricket = challenge.sport.toLowerCase().contains('cricket');

        return Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.borderSubtle,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              
              Row(
                children: [
                  CircleAvatar(
                    radius: 24,
                    backgroundColor: isCricket ? AppColors.sportCricket : AppColors.info,
                    child: Text(
                      details.name.substring(0, 1).toUpperCase(),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(details.name.toUpperCase(), style: AppTheme.displayStyle(fontSize: 15)),
                        const SizedBox(height: 2),
                        Text(challenge.creatorTeamName, style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.bgInset,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.flash_on_rounded, color: AppColors.gold, size: 14),
                        const SizedBox(width: 4),
                        Text('ELO ${details.elo}', style: AppTheme.tabularStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildStatBox('PLAYED', details.matchesPlayed.toString(), AppColors.textPrimary),
                  _buildStatBox('WON', details.matchesWon.toString(), AppColors.win),
                  _buildStatBox('WIN RATE', '$winRate%', AppColors.gold),
                ],
              ),
              const SizedBox(height: 20),
              Divider(color: AppColors.borderSubtle),
              const SizedBox(height: 16),
              
              Text('STATS & PREFERENCES', style: AppTheme.label),
              const SizedBox(height: 8),
              _buildDetailRow('Primary Sport', details.sport),
              _buildDetailRow(isCricket ? 'Batting Style' : 'Preference', details.preference1),
              _buildDetailRow(isCricket ? 'Bowling Style' : 'Format', details.preference2),
              if (details.cricHeroes != null)
                _buildDetailRow('CricHeroes Link', '@${details.cricHeroes}', valueColor: AppColors.win),
              
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.volt500,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('CLOSE PROFILE', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      },
    );
  }



  Widget _buildStatBox(String label, String value, Color color) {
    return Column(
      children: [
        Text(label, style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 6),
        Text(value, style: AppTheme.tabularStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
      ],
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(color: AppColors.textSecondary, fontSize: 13)),
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? AppColors.textPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  void _acceptChallenge(MockChallenge challenge) {
    final walletState = ref.read(walletProvider);

    if (walletState.depositPaise + walletState.winningsPaise + walletState.bonusPaise < challenge.entryFeePaise) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: AppColors.bgElevated,
          title: Text('INSUFFICIENT BALANCE', style: AppTheme.displayStyle(fontSize: 16, color: AppColors.loss)),
          content: Text(
            'Your wallet balance is insufficient to cover the ₹${(challenge.entryFeePaise / 100).toStringAsFixed(2)} entry fee.\n\nPlease top up your wallet.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('CANCEL', style: TextStyle(color: AppColors.textSecondary)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ref.read(walletProvider.notifier).depositMockFunds(50000); // ₹500
                AppSnackBar.showSuccess(context, 'Deposited ₹500.00 mock funds. You can now accept the challenge.');
              },
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.volt500),
              child: const Text('TOP UP ₹500', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
      return;
    }

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('CONFIRM ESCROW JOIN', style: AppTheme.displayStyle(fontSize: 16)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Joining match against ${challenge.creatorTeamName}',
              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
            const SizedBox(height: 8),
            Text(
              'Entry fee of ₹${(challenge.entryFeePaise / 100).toStringAsFixed(2)} will be locked in escrow.',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('CANCEL', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              
              final debited = ref.read(walletProvider.notifier).debitWallet(challenge.entryFeePaise);
              if (debited) {
                ref.read(challengesProvider.notifier).acceptChallenge(challenge.publicId).then((success) {
                  if (success) {
                    AppSnackBar.showSuccess(context, 'Challenge matched! Entry fee locked in escrow. Match at ${challenge.time}.');
                  } else {
                    AppSnackBar.showError(context, 'Failed to match challenge.');
                  }
                });
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.volt500),
            child: const Text('CONFIRM', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(challengesProvider);
    final activeChallenges = state.challenges;

    final filteredList = activeChallenges.where((c) {
      return _selectedSport == "All" || c.sport.toLowerCase() == _selectedSport.toLowerCase();
    }).toList();

    final l10n = ref.watch(l10nProvider);

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(l10n.matchmakingFeed.toUpperCase(), style: AppTheme.displayStyle(fontSize: 18)),
        centerTitle: true,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(16.0),
            color: AppColors.bgSurface,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'JOIN ACTIVE LEAGUE CHALLENGES',
                  style: AppTheme.label,
                ),
                const SizedBox(height: 4),
                Text(
                  'Escrow holds secure payouts. Play verified games, win the pot.',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 12),
                ),
              ],
            ),
          ),

          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Row(
              children: _sports.map((sport) {
                final isSelected = _selectedSport == sport;
                return Padding(
                  padding: const EdgeInsets.only(right: 8.0),
                  key: ValueKey(sport),
                  child: ChoiceChip(
                    label: Text(sport),
                    selected: isSelected,
                    showCheckmark: false,
                    onSelected: (selected) {
                      if (selected) setState(() => _selectedSport = sport);
                    },
                    selectedColor: AppColors.volt500,
                    backgroundColor: AppColors.bgSurface,
                    labelStyle: TextStyle(
                      color: isSelected ? AppColors.textInverse : AppColors.textSecondary,
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(20),
                      side: BorderSide(
                        color: isSelected ? AppColors.volt500 : AppColors.borderSubtle,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),

          Expanded(
            child: RefreshIndicator(
              onRefresh: () => ref.read(challengesProvider.notifier).refreshChallenges(),
              child: state.isLoading && filteredList.isEmpty
                  ? Center(child: CircularProgressIndicator(color: AppColors.volt500))
                  : filteredList.isEmpty
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: [
                            SizedBox(height: MediaQuery.of(context).size.height * 0.2),
                            Center(
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.sports_esports_rounded, size: 48, color: AppColors.textMuted),
                                  const SizedBox(height: 12),
                                  Text(
                                    'No open challenges available',
                                    style: TextStyle(color: AppColors.textSecondary, fontSize: 16),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        )
                      : ListView.builder(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    itemCount: filteredList.length,
                    itemBuilder: (context, index) {
                      final challenge = filteredList[index];
                      final isCricket = challenge.sport.toLowerCase().contains('cricket');

                      return GestureDetector(
                        onTap: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(
                              builder: (_) => ChallengeDetailScreen(challenge: challenge),
                            ),
                          );
                        },
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 16.0),
                          padding: const EdgeInsets.all(16.0),
                          decoration: BoxDecoration(
                            color: AppColors.bgSurface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.borderSubtle),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              GestureDetector(
                                onTap: () => _showHostProfileBottomSheet(context, challenge),
                                behavior: HitTestBehavior.opaque,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        CircleAvatar(
                                          radius: 20,
                                          backgroundColor: isCricket ? AppColors.sportCricket : AppColors.info,
                                          child: Text(
                                            challenge.creatorCaptainName.substring(0, 1).toUpperCase(),
                                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Text(
                                                  challenge.creatorTeamName,
                                                  style: AppTheme.displayStyle(fontSize: 14),
                                                ),
                                                const SizedBox(width: 4),
                                                const Icon(Icons.verified_rounded, color: AppColors.info, size: 14),
                                              ],
                                            ),
                                            const SizedBox(height: 2),
                                            Row(
                                              children: [
                                                Text(
                                                  challenge.creatorCaptainName,
                                                  style: AppTheme.bodySecondary.copyWith(
                                                    fontSize: 11, 
                                                    fontWeight: FontWeight.w600,
                                                    decoration: TextDecoration.underline,
                                                  ),
                                                ),
                                                const SizedBox(width: 6),
                                                Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                                  decoration: BoxDecoration(
                                                    color: AppColors.bgInset,
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: Text(
                                                    '${challenge.skillLevel.toUpperCase()} LEVEL',
                                                    style: TextStyle(
                                                      color: challenge.skillLevel == 'advanced'
                                                          ? AppColors.loss
                                                          : (challenge.skillLevel == 'intermediate' ? AppColors.dispute : AppColors.win),
                                                      fontSize: 8,
                                                      fontWeight: FontWeight.bold,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ],
                                        ),
                                      ],
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: AppColors.bgInset,
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(color: AppColors.borderSubtle),
                                      ),
                                      child: Text(
                                        challenge.sport.toUpperCase(),
                                        style: TextStyle(
                                          color: isCricket ? AppColors.sportCricket : AppColors.info,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(height: 14),

                              Row(
                                children: [
                                  Icon(Icons.location_on_rounded, color: AppColors.textMuted, size: 16),
                                  const SizedBox(width: 6),
                                  Text(challenge.arenaName, style: TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Icon(Icons.access_time_filled_rounded, color: AppColors.textMuted, size: 16),
                                  const SizedBox(width: 6),
                                  Text(challenge.time, style: TextStyle(fontSize: 13, color: AppColors.textPrimary)),
                                ],
                              ),
                              const SizedBox(height: 16),
                              Divider(color: AppColors.borderSubtle),
                              const SizedBox(height: 12),

                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text('PRIZE POOL', style: AppTheme.label),
                                      const SizedBox(height: 4),
                                      Text(
                                        '₹${(challenge.prizePoolPaise / 100).toStringAsFixed(0)}',
                                        style: AppTheme.tabularStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.bold,
                                          color: AppColors.gold,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        'Entry: ₹${(challenge.entryFeePaise / 100).toStringAsFixed(0)}',
                                        style: AppTheme.tabularStyle(fontSize: 11, color: AppColors.textSecondary),
                                      ),
                                    ],
                                  ),
                                  AppButton(
                                    label: 'JOIN MATCH',
                                    onPressed: () => _acceptChallenge(challenge),
                                    color: AppColors.volt500,
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
            ),
          ),
        ],
      ),
    );
  }
}
