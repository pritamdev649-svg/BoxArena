import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/models/challenge.dart';
import 'package:app/features/matchmaking/providers/public_player_provider.dart';
import 'package:app/features/wallet/providers/wallet_provider.dart';
import 'package:app/features/matchmaking/providers/challenges_provider.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/providers/locale_provider.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'challenge_detail_screen.dart';


class ChallengesScreen extends ConsumerStatefulWidget {
  const ChallengesScreen({super.key});

  @override
  ConsumerState<ChallengesScreen> createState() => _ChallengesScreenState();
}

class _ChallengesScreenState extends ConsumerState<ChallengesScreen> {
  String _selectedSport = "All";
  final List<String> _sports = ["All", "Badminton", "Box Cricket", "Turf Football"];

  /// The host's real profile.
  ///
  /// Was derived from `name.length` — a "record" that changed if the player
  /// corrected the spelling of their own name.
  void _showHostProfileBottomSheet(BuildContext context, Challenge challenge) {
    if (challenge.creatorCaptainPublicId.isEmpty) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => _HostProfileSheet(
        publicId: challenge.creatorCaptainPublicId,
        fallbackName: challenge.creatorCaptainName,
      ),
    );
  }



  void _acceptChallenge(Challenge challenge) {
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
                    AppSnackBar.showSuccess(context, 'Challenge matched! Entry fee locked in escrow. Match at ${challenge.timeLabel}.');
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
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: AppColors.borderSubtle),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.02),
                                blurRadius: 10,
                                offset: const Offset(0, 4),
                              ),
                            ],
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
                                        Container(
                                          decoration: BoxDecoration(
                                            shape: BoxShape.circle,
                                            border: Border.all(
                                              color: (isCricket ? AppColors.sportCricket : AppColors.volt500).withOpacity(0.3),
                                              width: 1.5,
                                            ),
                                          ),
                                          child: CircleAvatar(
                                            radius: 20,
                                            backgroundColor: isCricket ? AppColors.sportCricket.withOpacity(0.1) : AppColors.voltGlow,
                                            child: Text(
                                              challenge.creatorCaptainName.substring(0, 1).toUpperCase(),
                                              style: TextStyle(
                                                color: isCricket ? AppColors.sportCricket : AppColors.volt500,
                                                fontWeight: FontWeight.bold,
                                                fontSize: 13,
                                              ),
                                            ),
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
                                                  style: AppTheme.displayStyle(fontSize: 14).copyWith(
                                                    fontWeight: FontWeight.bold,
                                                  ),
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
                                                  padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                                                  decoration: BoxDecoration(
                                                    color: challenge.skillLevel == 'advanced'
                                                        ? AppColors.loss.withOpacity(0.1)
                                                        : (challenge.skillLevel == 'intermediate' ? AppColors.dispute.withOpacity(0.1) : AppColors.win.withOpacity(0.1)),
                                                    borderRadius: BorderRadius.circular(4),
                                                  ),
                                                  child: Text(
                                                    '${(challenge.skillLevel ?? 'any').toUpperCase()} LEVEL',
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
                                        color: isCricket ? AppColors.sportCricket.withOpacity(0.1) : AppColors.voltGlow,
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(
                                          color: (isCricket ? AppColors.sportCricket : AppColors.volt500).withOpacity(0.3),
                                        ),
                                      ),
                                      child: Text(
                                        challenge.sport.toUpperCase(),
                                        style: TextStyle(
                                          color: isCricket ? AppColors.sportCricket : AppColors.volt500,
                                          fontSize: 9,
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
                                  Expanded(child: Text(challenge.arenaName, style: TextStyle(fontSize: 13, color: AppColors.textPrimary, fontWeight: FontWeight.w500))),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Row(
                                children: [
                                  Icon(Icons.access_time_filled_rounded, color: AppColors.textMuted, size: 16),
                                  const SizedBox(width: 6),
                                  Text(challenge.timeLabel, style: TextStyle(fontSize: 13, color: AppColors.textPrimary, fontWeight: FontWeight.w500)),
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

/// Real numbers or an honest blank — never a plausible-looking guess.
class _HostProfileSheet extends ConsumerWidget {
  final String publicId;
  final String fallbackName;

  const _HostProfileSheet({required this.publicId, required this.fallbackName});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(publicPlayerProvider(publicId));

    return Padding(
      padding: const EdgeInsets.all(20),
      child: profile.when(
        loading: () => const SizedBox(
          height: 120,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, _) => SizedBox(
          height: 120,
          child: Center(
            child: Text(
              'Could not load $fallbackName.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
        ),
        data: (player) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              player.fullName,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            if (player.homeAreaName != null) ...[
              const SizedBox(height: 4),
              Text(
                player.homeAreaName!,
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
            ],
            const SizedBox(height: 20),
            if (!player.hasRecord)
              Text(
                'No completed matches yet, so there is no record to show.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              )
            else
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _MiniStat(label: 'ELO', value: '${player.eloRating}'),
                  _MiniStat(label: 'PLAYED', value: '${player.matchesPlayed}'),
                  _MiniStat(label: 'WON', value: '${player.wins}'),
                ],
              ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}

class _MiniStat extends StatelessWidget {
  final String label;
  final String value;

  const _MiniStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
        ),
        const SizedBox(height: 2),
        Text(label, style: AppTheme.label),
      ],
    );
  }
}
