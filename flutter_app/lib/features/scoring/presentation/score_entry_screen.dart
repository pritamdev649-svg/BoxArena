import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/utils/app_snackbar.dart';

class ScoreSet {
  int creatorPoints;
  int opponentPoints;
  ScoreSet({this.creatorPoints = 0, this.opponentPoints = 0});
}

class ScoreEntryScreen extends StatefulWidget {
  const ScoreEntryScreen({super.key});

  @override
  State<ScoreEntryScreen> createState() => _ScoreEntryScreenState();
}

class _ScoreEntryScreenState extends State<ScoreEntryScreen> {
  final List<ScoreSet> _sets = [
    ScoreSet(creatorPoints: 21, opponentPoints: 18),
    ScoreSet(creatorPoints: 19, opponentPoints: 21),
    ScoreSet(creatorPoints: 21, opponentPoints: 15),
  ];

  String? _validationError;
  String? _calculatedWinner;

  @override
  void initState() {
    super.initState();
    _validateMatchScores();
  }

  // Badminton Set-Points Rules Validator
  String? _validateSet(ScoreSet set, int setNumber) {
    final a = set.creatorPoints;
    final b = set.opponentPoints;

    if (a < 0 || b < 0) {
      return "Set $setNumber: Points cannot be negative.";
    }

    // A set must reach at least 21 points to win
    if (a < 21 && b < 21) {
      return "Set $setNumber: A side must reach at least 21 points.";
    }

    // Win by 2 points rule, up to a cap of 30
    final diff = (a - b).abs();
    final maxVal = a > b ? a : b;

    if (maxVal == 21) {
      // 21-19 or wider is valid. But 21-20 is invalid (must win by 2)
      if (diff < 2) {
        return "Set $setNumber: Must win by 2 points (e.g., 22-20).";
      }
    } else if (maxVal > 21 && maxVal < 30) {
      // If score is e.g. 23-22, difference is 1, which is invalid. Must be exactly 2 point lead.
      if (diff != 2) {
        return "Set $setNumber: Score $a-$b is invalid. Past 20-all, you must win by exactly 2 points.";
      }
    } else if (maxVal == 30) {
      // At 30, the diff can be 1 (30-29 is the absolute cap). 30-28 is invalid because it would have finished at 29-27.
      if (diff > 2) {
        return "Set $setNumber: Score $a-$b is invalid. Should have finished at ${(a > b ? 30 - diff + 2 : 30 - diff + 2)}-${(a > b ? 30 - diff : 30 - diff)}.";
      }
      if (diff == 0) {
        return "Set $setNumber: Cannot tie at 30-30.";
      }
    } else if (maxVal > 30) {
      return "Set $setNumber: Hard cap is 30 points. Scores above 30 are invalid.";
    }

    return null; // Valid
  }

  void _validateMatchScores() {
    setState(() {
      _validationError = null;
      _calculatedWinner = null;
    });

    int creatorSetWins = 0;
    int opponentSetWins = 0;

    for (int i = 0; i < _sets.length; i++) {
      final set = _sets[i];
      
      // Skip validating Set 3 if either side won 2-0 (best of 3 completed)
      if (i == 2 && (creatorSetWins == 2 || opponentSetWins == 2)) {
        // If they enter points in Set 3 even though it was 2-0, make sure they clear it out
        if (set.creatorPoints != 0 || set.opponentPoints != 0) {
          setState(() {
            _validationError = "Set 3 should not be played since a side already won 2-0.";
          });
          return;
        }
        break;
      }

      final error = _validateSet(set, i + 1);
      if (error != null) {
        setState(() {
          _validationError = error;
        });
        return;
      }

      if (set.creatorPoints > set.opponentPoints) {
        creatorSetWins++;
      } else {
        opponentSetWins++;
      }
    }

    // Check match completion
    if (creatorSetWins < 2 && opponentSetWins < 2) {
      setState(() {
        _validationError = "A player must win exactly 2 sets to claim the match.";
      });
      return;
    }

    setState(() {
      _calculatedWinner = creatorSetWins > opponentSetWins ? "Gomti Smashers (You)" : "Opponent Team";
    });
  }

  void _incrementPoints(int setIndex, bool isCreator, int delta) {
    setState(() {
      if (isCreator) {
        _sets[setIndex].creatorPoints = (_sets[setIndex].creatorPoints + delta).clamp(0, 30);
      } else {
        _sets[setIndex].opponentPoints = (_sets[setIndex].opponentPoints + delta).clamp(0, 30);
      }
      _validateMatchScores();
    });
  }

  void _submitScores() {
    _validateMatchScores();
    if (_validationError != null) return;

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text('SUBMIT SCORECARD', style: AppTheme.displayStyle(fontSize: 16)),
        content: Text(
          'Confirm submission of scorecard. Results will be locked pending opponent double-confirmation.',
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
              Navigator.pop(context);
              AppSnackBar.showSuccess(context, 'Scorecard submitted! Awaiting opponent confirmation.');
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.volt500),
            child: Text('SUBMIT', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text('RECORD MATCH SCORE', style: AppTheme.displayStyle(fontSize: 18)),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Instruction Box
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('BADMINTON LEAGUE RULES', style: AppTheme.label),
                  SizedBox(height: 8),
                  Text('• Played to 21 points. Must win by 2 points margin.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  SizedBox(height: 4),
                  Text('• Hard cap at 30 points. E.g. 30-29 is the absolute limit.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  SizedBox(height: 4),
                  Text('• Best-of-3 sets. First to win 2 sets claims the match.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
            SizedBox(height: 24),

            // Sets Input
            ...List.generate(3, (setIndex) {
              final setNum = setIndex + 1;
              final isSet3 = setIndex == 2;
              
              return Container(
                margin: const EdgeInsets.only(bottom: 16.0),
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderSubtle),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('SET $setNum', style: AppTheme.displayStyle(fontSize: 15, color: AppColors.volt500)),
                        if (isSet3)
                          Text(
                            'PLAYED ONLY IF 1-1 TIE',
                            style: TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                      ],
                    ),
                    SizedBox(height: 16),
                    Row(
                      children: [
                        // Creator (You)
                        Expanded(
                          child: _buildCounterColumn(
                            'Gomti Smashers (You)',
                            _sets[setIndex].creatorPoints,
                            (delta) => _incrementPoints(setIndex, true, delta),
                          ),
                        ),
                        // Separator
                        Container(
                          margin: const EdgeInsets.symmetric(horizontal: 16),
                          child: Text('VS', style: AppTheme.label),
                        ),
                        // Opponent
                        Expanded(
                          child: _buildCounterColumn(
                            'Opponent',
                            _sets[setIndex].opponentPoints,
                            (delta) => _incrementPoints(setIndex, false, delta),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              );
            }),

            // Error Display banner
            if (_validationError != null)
              Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.loss.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.loss.withOpacity(0.5)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.error_outline_rounded, color: AppColors.loss, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _validationError!,
                        style: TextStyle(color: AppColors.loss, fontSize: 12, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),

            // Winner display banner
            if (_calculatedWinner != null && _validationError == null)
              Container(
                margin: const EdgeInsets.symmetric(vertical: 12),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: AppColors.win.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.win.withOpacity(0.5)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.stars_rounded, color: AppColors.win, size: 20),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Projected Winner: $_calculatedWinner',
                        style: TextStyle(color: AppColors.win, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
              ),

            SizedBox(height: 24),

            // Submit Button
            ElevatedButton(
              onPressed: (_validationError != null) ? null : _submitScores,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.volt500,
                foregroundColor: Colors.black,
                disabledBackgroundColor: AppColors.borderSubtle,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('VALIDATE & SUBMIT', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ),
            SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildCounterColumn(String label, int value, Function(int) onDelta) {
    return Column(
      children: [
        Text(label, style: TextStyle(fontSize: 12, color: AppColors.textSecondary), textAlign: TextAlign.center),
        SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildRoundButton(Icons.remove, () => onDelta(-1)),
            SizedBox(width: 12),
            Text(
              value.toString(),
              style: AppTheme.tabularStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.white),
            ),
            SizedBox(width: 12),
            _buildRoundButton(Icons.add, () => onDelta(1)),
          ],
        ),
      ],
    );
  }

  Widget _buildRoundButton(IconData icon, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.all(6),
        decoration: BoxDecoration(
          color: AppColors.bgElevated,
          shape: BoxShape.circle,
          border: Border.all(color: AppColors.borderSubtle),
        ),
        child: Icon(icon, size: 16, color: Colors.white),
      ),
    );
  }
}
