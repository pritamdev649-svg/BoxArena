import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/widgets/app_loader.dart';
import 'package:app/features/scoring/models/rally_state.dart';

/// A captain's answer to a result the official recorded.
///
/// Only reachable when the official could NOT trigger payout — a team's own
/// person officiated, so their scorecard is on the record but the money still
/// waits on both captains (games_rule/badminton.md §6).
class ConfirmResultScreen extends ConsumerStatefulWidget {
  final String matchId;

  const ConfirmResultScreen({super.key, required this.matchId});

  @override
  ConsumerState<ConfirmResultScreen> createState() => _ConfirmResultScreenState();
}

class _ConfirmResultScreenState extends ConsumerState<ConfirmResultScreen> {
  LiveMatch? _match;
  bool _loading = true;
  String? _pending;
  String? _error;
  String? _done;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final response = await ref.read(apiClientProvider).get(ApiRoutes.matchLive(widget.matchId));
      if (!mounted) return;
      setState(() {
        _match = LiveMatch.fromJson(response['data'] as Map<String, dynamic>);
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = '$e';
        _loading = false;
      });
    }
  }

  Future<void> _answer(bool agree) async {
    setState(() {
      _pending = agree ? 'agree' : 'dispute';
      _error = null;
    });

    try {
      final response = await ref
          .read(apiClientProvider)
          .post(ApiRoutes.matchConfirmResult(widget.matchId), {'agree': agree});
      final data = response['data'] as Map<String, dynamic>;
      if (!mounted) return;

      setState(() {
        if (data['disputed'] == true) {
          _done = 'Dispute raised. Ops will review the point-by-point record.';
        } else if (data['settled'] == true) {
          _done = 'Both captains agreed. The winner has been paid.';
        } else {
          _done = 'Recorded. Waiting for the other captain.';
        }
      });
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _pending = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final match = _match;

    return Scaffold(
      appBar: AppBar(title: const Text('Confirm the result')),
      body: SafeArea(
        child: _loading
            ? const Center(child: AppLoader())
            : Padding(
                padding: const EdgeInsets.all(16),
                child: match == null
                    ? Text(_error ?? 'Match not found', style: TextStyle(color: AppColors.loss))
                    : _body(match),
              ),
      ),
    );
  }

  Widget _body(LiveMatch match) {
    if (_done != null) {
      return Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(border: Border.all(color: AppColors.borderDefault)),
        child: Text(_done!, textAlign: TextAlign.center, style: TextStyle(color: AppColors.textPrimary)),
      );
    }

    if (!match.state.isComplete) {
      return Text('This match has not finished yet.',
          style: TextStyle(color: AppColors.textSecondary));
    }

    final tally = match.state.gamesWon;
    final winner =
        match.state.winner == 'creator' ? match.creatorLabel : match.opponentLabel;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('THE OFFICIAL RECORDED',
            style: TextStyle(fontSize: 11, letterSpacing: 1, color: AppColors.textMuted)),
        const SizedBox(height: 8),
        Text('$winner — ${tally.creator}–${tally.opponent}',
            style: TextStyle(
                fontSize: 20, fontWeight: FontWeight.w700, color: AppColors.textPrimary)),
        const SizedBox(height: 12),
        Text(
          'Prize money is released once both captains agree. If this is wrong, say so — it opens '
          'a dispute for ops to review.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(_error!, style: TextStyle(color: AppColors.loss, fontSize: 13)),
        ],
        const SizedBox(height: 20),
        AppButton(
          label: _pending == 'agree' ? 'Sending…' : 'I agree',
          onPressed: _pending != null ? null : () => _answer(true),
        ),
        const SizedBox(height: 10),
        OutlinedButton(
          onPressed: _pending != null ? null : () => _answer(false),
          child: Text(_pending == 'dispute' ? 'Sending…' : 'This is wrong'),
        ),
        const SizedBox(height: 12),
        Text('Every rally was logged, so a dispute is reviewed against the full record.',
            style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
      ],
    );
  }
}
