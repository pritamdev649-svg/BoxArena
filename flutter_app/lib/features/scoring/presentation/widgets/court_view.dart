import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/features/scoring/models/rally_state.dart';

/// The court seen from above, with the server's position marked.
///
/// This is the one part of the screen an umpire checks against reality: if the
/// diagram says right-hand court and the player is standing left, someone has
/// mis-tapped. Position comes from the server (score parity decides the court),
/// so a correction can never leave the diagram lying.
class CourtView extends StatelessWidget {
  final RallyState state;
  final List<String> creatorNames;
  final List<String> opponentNames;

  const CourtView({
    super.key,
    required this.state,
    required this.creatorNames,
    required this.opponentNames,
  });

  @override
  Widget build(BuildContext context) {
    return AspectRatio(
      aspectRatio: 2,
      child: Container(
        decoration: BoxDecoration(
          color: AppColors.bgInset,
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Column(
          children: [
            Expanded(
              child: _CourtHalf(
                names: opponentNames,
                isServingSide: state.serving == 'opponent',
                serveCourt: state.serveCourt,
                rightIndex: state.doubles?.opponentRightIndex ?? 0,
                isDoubles: state.isDoubles,
                isFar: true,
              ),
            ),
            // The net.
            Container(height: 2, color: AppColors.borderStrong),
            Expanded(
              child: _CourtHalf(
                names: creatorNames,
                isServingSide: state.serving == 'creator',
                serveCourt: state.serveCourt,
                rightIndex: state.doubles?.creatorRightIndex ?? 0,
                isDoubles: state.isDoubles,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CourtHalf extends StatelessWidget {
  final List<String> names;
  final bool isServingSide;
  final String serveCourt;
  final int rightIndex;
  final bool isDoubles;
  final bool isFar;

  const _CourtHalf({
    required this.names,
    required this.isServingSide,
    required this.serveCourt,
    required this.rightIndex,
    required this.isDoubles,
    this.isFar = false,
  });

  /// Singles has one occupant; in doubles the partner holds the other court.
  int _occupantIndex(String court) {
    if (!isDoubles) return 0;
    return court == 'right' ? rightIndex : 1 - rightIndex;
  }

  @override
  Widget build(BuildContext context) {
    // "Right" is from the player's own point of view, so the far side's right
    // is the viewer's left. Mirroring is what makes the diagram match what the
    // umpire sees from the chair.
    final cells = isFar ? ['left', 'right'] : ['right', 'left'];

    return Row(
      children: cells.map((court) {
        final index = _occupantIndex(court);
        final name = index < names.length ? names[index] : '';
        final isServer = isServingSide && serveCourt == court;

        return Expanded(
          child: Container(
            decoration: BoxDecoration(
              color: isServer ? AppColors.voltGlow : Colors.transparent,
              border: Border(
                right: BorderSide(
                  color: court == cells.first ? AppColors.borderSubtle : Colors.transparent,
                ),
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 4),
                  child: Text(
                    name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                ),
                if (isServer) ...[
                  const SizedBox(height: 6),
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: AppColors.volt500,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}
