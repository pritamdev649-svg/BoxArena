import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/features/scoring/models/rally_state.dart';

/// Deliberately the biggest thing on screen. One tap = one rally.
///
/// Full-height halves because this is operated one-handed, outdoors, at night —
/// a mis-tap is the one error the layout has to make hard.
class PointZones extends StatelessWidget {
  final RallyState state;
  final String creatorName;
  final String opponentName;
  final bool disabled;
  final void Function(String side) onPoint;

  const PointZones({
    super.key,
    required this.state,
    required this.creatorName,
    required this.opponentName,
    required this.disabled,
    required this.onPoint,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _Zone(
            label: creatorName,
            points: state.current.creator,
            isServing: state.serving == 'creator',
            disabled: disabled,
            onTap: () => onPoint('creator'),
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          child: _Zone(
            label: opponentName,
            points: state.current.opponent,
            isServing: state.serving == 'opponent',
            disabled: disabled,
            onTap: () => onPoint('opponent'),
          ),
        ),
      ],
    );
  }
}

class _Zone extends StatelessWidget {
  final String label;
  final int points;
  final bool isServing;
  final bool disabled;
  final VoidCallback onTap;

  const _Zone({
    required this.label,
    required this.points,
    required this.isServing,
    required this.disabled,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: InkWell(
        onTap: disabled ? null : onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 28),
          decoration: BoxDecoration(
            color: isServing ? AppColors.voltGlow : AppColors.bgSurface,
            border: Border.all(
              color: isServing ? AppColors.volt500 : AppColors.borderDefault,
            ),
          ),
          child: Column(
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 8),
              Text(
                '$points',
                style: TextStyle(
                  fontSize: 52,
                  fontWeight: FontWeight.w700,
                  height: 1,
                  color: AppColors.textPrimary,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
              const SizedBox(height: 8),
              // Never colour alone — the serving side is also labelled.
              Text(
                isServing ? 'SERVING' : '',
                style: TextStyle(
                  fontSize: 10,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                  color: AppColors.volt400,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Optional colour on the NEXT rally only.
///
/// A one-shot tag rather than a mode: an umpire who left "Winner" switched on
/// would silently mis-attribute every following point, and nobody would notice
/// until the statistics looked absurd.
class OutcomeTags extends StatelessWidget {
  final String? selected;
  final void Function(String? next) onSelect;

  const OutcomeTags({super.key, required this.selected, required this.onSelect});

  static const _options = [
    ('winner', 'Winner'),
    ('unforced_error', 'Unforced error'),
    ('service_fault', 'Service fault'),
  ];

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: [
        Text('Tag the rally', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
        ..._options.map((option) {
          final isOn = selected == option.$1;
          return GestureDetector(
            onTap: () => onSelect(isOn ? null : option.$1),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isOn ? AppColors.volt500 : Colors.transparent,
                border: Border.all(
                  color: isOn ? AppColors.volt500 : AppColors.borderDefault,
                ),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                option.$2,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isOn ? FontWeight.w600 : FontWeight.w400,
                  color: isOn ? AppColors.textInverse : AppColors.textSecondary,
                ),
              ),
            ),
          );
        }),
      ],
    );
  }
}
