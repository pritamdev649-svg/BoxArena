import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/features/scoring/models/rally_state.dart';

/// One row per side: serving dot, name, current score, completed games.
/// The shape every scoreboard in the sport uses, so an official can read it
/// without being taught.
class ScoreHeader extends StatelessWidget {
  final RallyState state;
  final String creatorName;
  final String opponentName;

  const ScoreHeader({
    super.key,
    required this.state,
    required this.creatorName,
    required this.opponentName,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        children: [
          _SideRow(
            name: creatorName,
            current: state.current.creator,
            games: state.games.map((g) => g.creator).toList(),
            isServing: state.serving == 'creator',
          ),
          Divider(height: 1, color: AppColors.borderSubtle),
          _SideRow(
            name: opponentName,
            current: state.current.opponent,
            games: state.games.map((g) => g.opponent).toList(),
            isServing: state.serving == 'opponent',
          ),
        ],
      ),
    );
  }
}

class _SideRow extends StatelessWidget {
  final String name;
  final int current;
  final List<int> games;
  final bool isServing;

  const _SideRow({
    required this.name,
    required this.current,
    required this.games,
    required this.isServing,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          // Shuttle-side marker: a dot, not colour alone.
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: isServing ? AppColors.volt500 : Colors.transparent,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          SizedBox(
            width: 44,
            child: Text(
              '$current',
              textAlign: TextAlign.right,
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          ...games.map(
            (points) => SizedBox(
              width: 28,
              child: Text(
                '$points',
                textAlign: TextAlign.right,
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textMuted,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The call an umpire would say aloud. The SERVER's score is announced first,
/// which is the actual convention — getting it backwards is the kind of detail
/// a real official notices immediately.
String umpireCall(RallyState state) {
  if (state.isComplete) return 'Match complete';

  final serverPoints =
      state.serving == 'creator' ? state.current.creator : state.current.opponent;
  final receiverPoints =
      state.serving == 'creator' ? state.current.opponent : state.current.creator;
  final score = '$serverPoints–$receiverPoints';

  if (serverPoints == receiverPoints && serverPoints >= 20) return 'Deuce. $score';
  return score;
}
