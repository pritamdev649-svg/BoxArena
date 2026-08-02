import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/widgets/app_loader.dart';
import 'package:app/features/scoring/models/rally_state.dart';
import 'package:app/features/scoring/providers/live_scoring_provider.dart';
import 'package:app/features/scoring/presentation/widgets/court_view.dart';
import 'package:app/features/scoring/presentation/widgets/point_zones.dart';
import 'package:app/features/scoring/presentation/widgets/score_header.dart';

/// The official's scoreboard.
///
/// Same surface as the web screen and against the same endpoints, so an
/// official can pick up either device mid-match and see identical state.
class LiveScoringScreen extends ConsumerStatefulWidget {
  final String matchId;

  const LiveScoringScreen({super.key, required this.matchId});

  @override
  ConsumerState<LiveScoringScreen> createState() => _LiveScoringScreenState();
}

class _LiveScoringScreenState extends ConsumerState<LiveScoringScreen> {
  @override
  void initState() {
    super.initState();
    // Loads the board for this match once the first frame is scheduled.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(liveScoringProvider.notifier).open(widget.matchId);
    });
  }

  String? _outcome;
  String? _done;
  Timer? _clock;
  Duration _elapsed = Duration.zero;

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  /// Ticks against the real start instant, not a local counter — a
  /// backgrounded app freezes timers and would under-report the match length.
  void _startClock(DateTime startedAt) {
    _clock?.cancel();
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      setState(() => _elapsed = DateTime.now().difference(startedAt));
    });
  }

  String get _clockLabel {
    final minutes = _elapsed.inMinutes;
    final seconds = _elapsed.inSeconds % 60;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(liveScoringProvider);
    final notifier = ref.read(liveScoringProvider.notifier);
    final match = state.match;

    if (match != null && match.startedAt != null && _clock == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _startClock(match.startedAt!));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Score match')),
      body: SafeArea(
        child: state.loading
            ? const Center(child: AppLoader())
            : match == null
                ? _ErrorView(message: state.error ?? 'Match not found')
                : Padding(
                    padding: const EdgeInsets.all(12),
                    child: match.status == 'scheduled'
                        ? _StartPanel(busy: state.busy, error: state.error, onStart: notifier.start)
                        : _body(match, state, notifier),
                  ),
      ),
    );
  }

  Widget _body(LiveMatch match, LiveScoringState state, LiveScoringNotifier notifier) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (match.startedAt != null)
            Text(
              'Elapsed $_clockLabel',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          const SizedBox(height: 8),
          ScoreHeader(
            state: match.state,
            creatorName: match.creatorLabel,
            opponentName: match.opponentLabel,
          ),
          const SizedBox(height: 8),
          Align(
            alignment: Alignment.centerLeft,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              color: AppColors.volt500,
              child: Text(
                umpireCall(match.state),
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: AppColors.textInverse,
                ),
              ),
            ),
          ),
          if (state.notice == 'changeEnds') ...[
            const SizedBox(height: 8),
            _Banner(text: 'Change ends', color: AppColors.volt500),
          ],
          if (state.error != null) ...[
            const SizedBox(height: 8),
            _Banner(text: state.error!, color: AppColors.loss),
          ],
          const SizedBox(height: 12),
          if (match.state.isComplete)
            _CompletePanel(
              match: match,
              busy: state.busy,
              done: _done,
              onConfirm: () async {
                final result = await notifier.confirmResult();
                if (!mounted || result == null) return;
                setState(() {
                  _done = result == 'settled'
                      ? 'Result confirmed. The winner has been paid.'
                      : 'Result recorded. Both captains must agree before the prize is released.';
                });
              },
            )
          else ...[
            CourtView(
              state: match.state,
              creatorNames: match.creatorNames,
              opponentNames: match.opponentNames,
            ),
            const SizedBox(height: 12),
            OutcomeTags(selected: _outcome, onSelect: (next) => setState(() => _outcome = next)),
            const SizedBox(height: 12),
            PointZones(
              state: match.state,
              creatorName: match.creatorLabel,
              opponentName: match.opponentLabel,
              disabled: state.busy,
              onPoint: (side) {
                notifier.recordPoint(side, outcome: _outcome);
                // The tag applies to one rally, then clears.
                setState(() => _outcome = null);
              },
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: state.busy ? null : notifier.undo,
                  icon: const Icon(Icons.undo, size: 18),
                  label: const Text('Undo'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: state.busy ? null : notifier.timeout,
                  icon: const Icon(Icons.timer_outlined, size: 18),
                  label: const Text('Timeout'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StartPanel extends StatelessWidget {
  final bool busy;
  final String? error;
  final Future<void> Function() onStart;

  const _StartPanel({required this.busy, required this.error, required this.onStart});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            'Both teams and you are at the venue.\nStarting locks the scoreboard to this device.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.textSecondary),
          ),
          if (error != null) ...[
            const SizedBox(height: 12),
            Text(error!, style: TextStyle(color: AppColors.loss)),
          ],
          const SizedBox(height: 20),
          AppButton(label: busy ? 'Starting…' : 'Start match', onPressed: busy ? null : onStart),
        ],
      ),
    );
  }
}

class _CompletePanel extends StatelessWidget {
  final LiveMatch match;
  final bool busy;
  final String? done;
  final Future<void> Function() onConfirm;

  const _CompletePanel({
    required this.match,
    required this.busy,
    required this.done,
    required this.onConfirm,
  });

  @override
  Widget build(BuildContext context) {
    if (done != null) {
      return _Banner(text: done!, color: AppColors.win);
    }

    final tally = match.state.gamesWon;
    final winnerName =
        match.state.winner == 'creator' ? match.creatorLabel : match.opponentLabel;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        border: Border.all(color: AppColors.borderDefault),
      ),
      child: Column(
        children: [
          Text('MATCH COMPLETE',
              style: TextStyle(fontSize: 11, letterSpacing: 1.2, color: AppColors.textMuted)),
          const SizedBox(height: 8),
          Text(winnerName,
              textAlign: TextAlign.center,
              style: TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          Text('${tally.creator}–${tally.opponent}',
              style: TextStyle(color: AppColors.textSecondary)),
          const SizedBox(height: 16),
          AppButton(
            label: busy ? 'Confirming…' : 'Confirm final result',
            onPressed: busy ? null : onConfirm,
          ),
        ],
      ),
    );
  }
}

class _Banner extends StatelessWidget {
  final String text;
  final Color color;

  const _Banner({required this.text, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(text,
          textAlign: TextAlign.center,
          style: TextStyle(color: color, fontWeight: FontWeight.w500)),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String message;

  const _ErrorView({required this.message});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Text(message, textAlign: TextAlign.center, style: TextStyle(color: AppColors.loss)),
      ),
    );
  }
}
