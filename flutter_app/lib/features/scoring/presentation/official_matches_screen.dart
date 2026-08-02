import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/widgets/app_loader.dart';

/// The official's own fixture list — what they are booked to officiate.
///
/// This is the entry point on mobile: an umpire arrives at the venue, opens
/// the app, and taps today's match. Without it the scoreboard is only
/// reachable by pasting a match id, which is not a thing anyone will do.
final officialMatchesProvider = FutureProvider.autoDispose<List<dynamic>>((ref) async {
  final response = await ref.read(apiClientProvider).get(ApiRoutes.officialMyMatches);
  return (response['data'] as List?) ?? [];
});

class OfficialMatchesScreen extends ConsumerWidget {
  const OfficialMatchesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final matches = ref.watch(officialMatchesProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('My matches')),
      body: matches.when(
        loading: () => const Center(child: AppLoader()),
        error: (error, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text('$error',
                textAlign: TextAlign.center, style: TextStyle(color: AppColors.loss)),
          ),
        ),
        data: (list) {
          if (list.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'No matches assigned to you yet.\nCaptains choose an official when they set up a match.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(12),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final match = list[index] as Map<String, dynamic>;
              return _MatchTile(match: match);
            },
          );
        },
      ),
    );
  }
}

class _MatchTile extends StatelessWidget {
  final Map<String, dynamic> match;

  const _MatchTile({required this.match});

  /// Both captains must have agreed before the official can start scoring.
  bool get _locked =>
      match['officialConfirmedByCreator'] == true &&
      match['officialConfirmedByOpponent'] == true;

  @override
  Widget build(BuildContext context) {
    final publicId = match['publicId'] as String? ?? '';
    final scheduledAt = DateTime.tryParse(match['scheduledAt'] as String? ?? '');
    final status = match['status'] as String? ?? '';

    return InkWell(
      onTap: () => context.push('/score/$publicId'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${match['sport'] ?? ''} · ${match['format'] ?? ''}',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    scheduledAt == null
                        ? publicId
                        : '${scheduledAt.toLocal()}'.substring(0, 16),
                    style: TextStyle(fontSize: 12, color: AppColors.textMuted),
                  ),
                ],
              ),
            ),
            _StatusChip(status: _locked ? status : 'awaiting captains'),
            const SizedBox(width: 6),
            Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
          ],
        ),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;

  const _StatusChip({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      'in_progress' => AppColors.volt500,
      'verified' => AppColors.win,
      'pending_confirmation' => AppColors.dispute,
      _ => AppColors.textMuted,
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        border: Border.all(color: color.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(fontSize: 10, color: color, fontWeight: FontWeight.w600),
      ),
    );
  }
}
