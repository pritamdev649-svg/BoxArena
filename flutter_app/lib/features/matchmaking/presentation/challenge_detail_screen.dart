import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/models/challenge.dart';
import 'package:app/features/wallet/providers/wallet_provider.dart';
import 'package:app/features/matchmaking/providers/challenges_provider.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'package:app/features/matchmaking/providers/public_player_provider.dart';


/// A player's profile, opened from the squad chip.
///
/// Fetched from `GET /public/players/:publicId`. The previous version derived
/// Elo, matches played and win rate from `name.hashCode` — a number that looks
/// like a record, changes if the player renames themselves, and describes
/// nobody.
class _PlayerProfileSheet extends ConsumerWidget {
  final String publicId;
  final String fallbackName;

  const _PlayerProfileSheet({
    required this.publicId,
    required this.fallbackName,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(publicPlayerProvider(publicId));

    return Padding(
      padding: const EdgeInsets.all(20.0),
      child: profile.when(
        loading: () => const SizedBox(
          height: 120,
          child: Center(child: CircularProgressIndicator()),
        ),
        error: (error, _) => SizedBox(
          height: 120,
          child: Center(
            child: Text(
              'Could not load $fallbackName\'s profile.',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
        ),
        data: (player) => Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.info,
                  child: Text(
                    player.fullName.characters.first.toUpperCase(),
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
                        player.fullName,
                        style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      if (player.homeAreaName != null)
                        Text(
                          player.homeAreaName!,
                          style: TextStyle(
                            color: AppColors.textSecondary,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            if (!player.hasRecord)
              Text(
                'No completed matches yet, so there is no record to show.',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              )
            else
              Row(
                children: [
                  Expanded(
                    child: _StatItem(
                      label: 'ELO',
                      value: '${player.eloRating}',
                      color: AppColors.gold,
                    ),
                  ),
                  Expanded(
                    child: _StatItem(
                      label: 'PLAYED',
                      value: '${player.matchesPlayed}',
                      color: AppColors.textPrimary,
                    ),
                  ),
                  Expanded(
                    child: _StatItem(
                      label: 'WIN RATE',
                      value:
                          '${((player.winRate ?? 0) * 100).toStringAsFixed(0)}%',
                      color: AppColors.win,
                    ),
                  ),
                ],
              ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _StatItem({
    required this.label,
    required this.value,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 18,
            fontWeight: FontWeight.w800,
          ),
        ),
        const SizedBox(height: 2),
        Text(label, style: AppTheme.label),
      ],
    );
  }
}

class ChallengeDetailScreen extends ConsumerWidget {
  final Challenge challenge;

  const ChallengeDetailScreen({super.key, required this.challenge});

  void _showPlayerProfile(BuildContext context, String publicId, String name) {
    if (publicId.isEmpty) return;

    showModalBottomSheet(
      context: context,
      backgroundColor: AppColors.bgSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) =>
          _PlayerProfileSheet(publicId: publicId, fallbackName: name),
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

              /// The SERVER moves the money — accepting locks the entry fee in
              /// escrow. Debiting locally first meant the app showed a balance
              /// the backend disagreed with whenever accept failed.
              ref
                  .read(challengesProvider.notifier)
                  .acceptChallenge(challenge.publicId)
                  .then((success) {
                if (!context.mounted) return;

                if (success) {
                  ref.read(walletProvider.notifier).refreshWallet();
                  AppSnackBar.showSuccess(
                    context,
                    'Challenge matched. Entry fee locked in escrow. '
                    'Match at ${challenge.timeLabel}.',
                  );
                  Navigator.pop(context);
                } else {
                  AppSnackBar.showError(context, 'Failed to match challenge.');
                }
              });
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
    final format = challenge.teamFormat ?? (isCricket ? '6v6' : 'doubles');
    /// Only the captain is known here — the feed returns the team name and its
    /// captain, not the roster. Listing invented teammates alongside a real
    /// captain made the whole card look made up.
    final squad = [challenge.creatorCaptainName];

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
                    challenge.timeLabel,
                  ),
                  _buildIconDetailRow(
                    Icons.trending_up_rounded,
                    'Min Skill Required',
                    (challenge.skillLevel ?? 'any').toUpperCase(),
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
                        onTap: () => _showPlayerProfile(
                          context,
                          challenge.creatorCaptainPublicId,
                          player,
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

}
