import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/mock/seed_data.dart';
import 'package:app/features/wallet/providers/wallet_provider.dart';
import 'package:app/features/matchmaking/providers/challenges_provider.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/utils/app_snackbar.dart';

class PlayerDetailStats {
  final String name;
  final String sport;
  final String skillLevel;
  final int elo;
  final int matchesPlayed;
  final int matchesWon;
  final String handOrBat;
  final String formatOrBowl;
  final String? cricHeroes;

  PlayerDetailStats({
    required this.name,
    required this.sport,
    required this.skillLevel,
    required this.elo,
    required this.matchesPlayed,
    required this.matchesWon,
    required this.handOrBat,
    required this.formatOrBowl,
    this.cricHeroes,
  });
}

class ChallengeDetailScreen extends ConsumerWidget {
  final MockChallenge challenge;

  const ChallengeDetailScreen({super.key, required this.challenge});

  PlayerDetailStats _getMockPlayerStats(
    String name,
    String sport,
    String skillLevel,
  ) {
    final isCricket = sport.toLowerCase().contains('cricket');
    final matches = (name.hashCode.abs() % 25) + 15;
    final won = (matches * 0.65).toInt();
    final elo = 1000 + (name.hashCode.abs() % 400);

    return PlayerDetailStats(
      name: name,
      sport: sport,
      skillLevel: skillLevel,
      elo: elo,
      matchesPlayed: matches,
      matchesWon: won,
      handOrBat: isCricket ? "Right-hand bat" : "Right-handed",
      formatOrBowl: isCricket ? "Spin bowler" : "Both formats",
      cricHeroes: isCricket ? name.toLowerCase().replaceAll(' ', '_') : null,
    );
  }

  List<String> _getMockTeammates(String captain, String sport, String format) {
    if (format.contains('Singles') || format == '1v1') return [];
    if (format.contains('Doubles') || format == '2v2') {
      return ['${captain.split(" ").first}\'s Partner'];
    }
    final count = format.toLowerCase().contains('6v6')
        ? 5
        : (format.toLowerCase().contains('8v8') ? 7 : 10);
    return List.generate(count, (index) => 'Teammate #${index + 1}');
  }

  void _showPlayerProfileModal(
    BuildContext context,
    String playerName,
    String sport,
    String skillLevel,
  ) {
    final stats = _getMockPlayerStats(playerName, sport, skillLevel);
    final winRate = ((stats.matchesWon / stats.matchesPlayed) * 100)
        .toStringAsFixed(0);
    final isCricket = sport.toLowerCase().contains('cricket');

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) {
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
                    backgroundColor: isCricket
                        ? AppColors.sportCricket
                        : AppColors.info,
                    child: Text(
                      stats.name.substring(0, 1).toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          stats.name.toUpperCase(),
                          style: AppTheme.displayStyle(fontSize: 15),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          sport,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: AppColors.bgInset,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.flash_on_rounded,
                          color: AppColors.gold,
                          size: 14,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          'ELO ${stats.elo}',
                          style: AppTheme.tabularStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  _buildStatItem(
                    'PLAYED',
                    stats.matchesPlayed.toString(),
                    AppColors.textPrimary,
                  ),
                  _buildStatItem(
                    'WON',
                    stats.matchesWon.toString(),
                    AppColors.win,
                  ),
                  _buildStatItem('WIN RATE', '$winRate%', AppColors.gold),
                ],
              ),
              const SizedBox(height: 20),
              Divider(color: AppColors.borderSubtle),
              const SizedBox(height: 16),

              Text('GAMEPLAY SETTINGS', style: AppTheme.label),
              const SizedBox(height: 8),
              _buildDetailRow('Hand Preference', stats.handOrBat),
              _buildDetailRow('Playing Format', stats.formatOrBowl),
              if (stats.cricHeroes != null)
                _buildDetailRow(
                  'CricHeroes Link',
                  '@${stats.cricHeroes}',
                  valueColor: AppColors.win,
                ),

              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.volt500,
                  foregroundColor: Colors.black,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'CLOSE PROFILE',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildStatItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            color: AppColors.textMuted,
            fontSize: 10,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: AppTheme.tabularStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
      ],
    );
  }

  void _acceptChallenge(BuildContext context, WidgetRef ref) {
    final walletState = ref.read(walletProvider);

    if (walletState.depositPaise +
            walletState.winningsPaise +
            walletState.bonusPaise <
        challenge.entryFeePaise) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: AppColors.bgElevated,
          title: Text(
            'INSUFFICIENT BALANCE',
            style: AppTheme.displayStyle(fontSize: 16, color: AppColors.loss),
          ),
          content: Text(
            'Your wallet balance is insufficient to cover the ₹${(challenge.entryFeePaise / 100).toStringAsFixed(2)} entry fee.\n\nPlease top up your wallet.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'CANCEL',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ref
                    .read(walletProvider.notifier)
                    .depositMockFunds(50000); // ₹500
                AppSnackBar.showSuccess(
                  context,
                  'Deposited ₹500.00 mock funds. You can now accept the challenge.',
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.volt500,
              ),
              child: const Text(
                'TOP UP ₹500',
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
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
        title: Text(
          'CONFIRM ESCROW JOIN',
          style: AppTheme.displayStyle(fontSize: 16),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Joining match against ${challenge.creatorTeamName}',
              style: const TextStyle(
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
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
            child: Text(
              'CANCEL',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);

              final debited = ref
                  .read(walletProvider.notifier)
                  .debitWallet(challenge.entryFeePaise);
              if (debited) {
                ref
                    .read(challengesProvider.notifier)
                    .acceptChallenge(challenge.publicId)
                    .then((success) {
                  if (success) {
                    AppSnackBar.showSuccess(
                      context,
                      'Challenge matched! Entry fee locked in escrow. Match at ${challenge.time}.',
                    );
                    Future.delayed(Duration.zero, () {
                      if (context.mounted) {
                        Navigator.pop(context);
                      }
                    });
                  } else {
                    AppSnackBar.showError(
                      context,
                      'Failed to match challenge.',
                    );
                  }
                });
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.volt500),
            child: const Text(
              'CONFIRM',
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isCricket = challenge.sport.toLowerCase().contains('cricket');
    final format =
        challenge.teamFormat ?? (isCricket ? '6v6' : 'Doubles (2v2)');
    final squad =
        challenge.squadPlayers ??
        [
          challenge.creatorCaptainName,
          ..._getMockTeammates(
            challenge.creatorCaptainName,
            challenge.sport,
            format,
          ),
        ];

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(
          challenge.creatorTeamName.toUpperCase(),
          style: AppTheme.displayStyle(fontSize: 16),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Top Modern Header Card
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppColors.bgSurface, AppColors.bgElevated],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: isCricket
                        ? AppColors.sportCricket
                        : AppColors.info,
                    child: Text(
                      challenge.creatorCaptainName
                          .substring(0, 1)
                          .toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 24,
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    challenge.creatorTeamName.toUpperCase(),
                    style: AppTheme.displayStyle(fontSize: 18),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.shield_rounded,
                        color: AppColors.info,
                        size: 14,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        'HOSTED BY ${challenge.creatorCaptainName.toUpperCase()}',
                        style: TextStyle(
                          color: AppColors.textMuted,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Details Table Card
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
                  Text('MATCH PARAMETERS', style: AppTheme.label),
                  const SizedBox(height: 12),
                  _buildIconDetailRow(
                    Icons.location_on_rounded,
                    'Arena',
                    challenge.arenaName,
                  ),
                  _buildIconDetailRow(
                    Icons.sports_esports_rounded,
                    'Sport',
                    challenge.sport,
                  ),
                  _buildIconDetailRow(
                    Icons.schedule_rounded,
                    'Time slot',
                    challenge.time,
                  ),
                  _buildIconDetailRow(
                    Icons.trending_up_rounded,
                    'Min Skill Required',
                    challenge.skillLevel.toUpperCase(),
                    valueColor: challenge.skillLevel == 'advanced'
                        ? AppColors.loss
                        : AppColors.win,
                  ),
                  _buildIconDetailRow(Icons.group_rounded, 'Format', format),
                  _buildIconDetailRow(
                    Icons.payments_rounded,
                    'Entry Fee',
                    '₹${(challenge.entryFeePaise / 100).toStringAsFixed(0)}',
                  ),
                  _buildIconDetailRow(
                    Icons.emoji_events_rounded,
                    'Prize Pool',
                    '₹${(challenge.prizePoolPaise / 100).toStringAsFixed(0)}',
                    valueColor: AppColors.gold,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Host Squad section
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
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('HOST SQUAD', style: AppTheme.label),
                      Text(
                        '${squad.length} Players',
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Tap on any player profile to inspect stats',
                    style: TextStyle(
                      color: AppColors.textMuted,
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: squad.map((player) {
                      final isCaptain = player == challenge.creatorCaptainName;
                      return GestureDetector(
                        onTap: () => _showPlayerProfileModal(
                          context,
                          player,
                          challenge.sport,
                          challenge.skillLevel,
                        ),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isCaptain
                                ? AppColors.voltGlow
                                : AppColors.bgInset,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isCaptain
                                  ? AppColors.volt500
                                  : AppColors.borderSubtle,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                isCaptain
                                    ? Icons.star_rounded
                                    : Icons.person_rounded,
                                size: 14,
                                color: isCaptain
                                    ? AppColors.gold
                                    : AppColors.textSecondary,
                              ),
                              const SizedBox(width: 6),
                              Text(
                                player + (isCaptain ? ' (Capt)' : ''),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: isCaptain
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                  color: AppColors.textPrimary,
                                  decoration: TextDecoration.underline,
                                  decorationStyle: TextDecorationStyle.dotted,
                                ),
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 36),

            // Action Button
            AppButton(
              label: 'JOIN MATCH',
              onPressed: () => _acceptChallenge(context, ref),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIconDetailRow(
    IconData icon,
    String label,
    String value, {
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10.0),
      child: Row(
        children: [
          Icon(icon, color: AppColors.textMuted, size: 16),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          const Spacer(),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: valueColor ?? AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                color: valueColor ?? AppColors.textPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
