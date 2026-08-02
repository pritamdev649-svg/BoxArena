import 'dart:async';
import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/models/arena.dart';
import 'package:app/core/widgets/arena_image.dart';
import 'package:app/core/widgets/app_loader.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'arena_info_screen.dart';
import 'fullscreen_table_screen.dart';

class ArenaDetailScreen extends StatefulWidget {
  final Arena arena;
  const ArenaDetailScreen({super.key, required this.arena});

  @override
  State<ArenaDetailScreen> createState() => _ArenaDetailScreenState();
}

class _ArenaDetailScreenState extends State<ArenaDetailScreen> {
  DateTime _selectedDate = DateTime.now();
  final List<String> _courts = ["Court A", "Court B", "Court C"];
  String? _selectedSport;

  @override
  void initState() {
    super.initState();
    if (widget.arena.sportsSupported.isNotEmpty) {
      _selectedSport = widget.arena.sportsSupported.first;
    }
  }
  
  // Track selected slots: "CourtName-HourString" (e.g. "Court A-18:00")
  final Set<String> _selectedSlots = {};
  
  // Mock booked slots
  final Set<String> _bookedSlots = {
    "Court A-09:00",
    "Court B-10:00",
    "Court B-18:00",
    "Court C-19:00",
    "Court C-20:00",
  };

  // Held slots and active timer
  Timer? _countdownTimer;
  int _holdSecondsRemaining = 300; // 5 minutes
  bool _isSlotsHeld = false;

  @override
  void dispose() {
    _countdownTimer?.cancel();
    super.dispose();
  }

  void _startHoldTimer() {
    _countdownTimer?.cancel();
    setState(() {
      _isSlotsHeld = true;
      _holdSecondsRemaining = 300;
    });
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_holdSecondsRemaining > 0) {
        setState(() {
          _holdSecondsRemaining--;
        });
      } else {
        timer.cancel();
        setState(() {
          _isSlotsHeld = false;
          _selectedSlots.clear();
        });
        AppSnackBar.showError(context, 'Your slot holds have expired. Please select again.');
      }
    });
  }

  void _toggleSlot(String court, String hour) {
    if (_isSlotsHeld) return; // Prevent selection changes once holds are active
    final key = "$court-$hour";
    if (_bookedSlots.contains(key)) return; // Block booked slots

    setState(() {
      if (_selectedSlots.contains(key)) {
        _selectedSlots.remove(key);
      } else {
        _selectedSlots.add(key);
      }
    });
  }

  void _openFullscreenTable() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => FullscreenTableScreen(
          courts: _courts,
          hours: const [
            "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", 
            "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", 
            "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
          ],
          selectedSlots: _selectedSlots,
          bookedSlots: _bookedSlots,
          isSlotsHeld: _isSlotsHeld,
          onSlotToggled: _toggleSlot,
        ),
      ),
    ).then((_) {
      setState(() {});
    });
  }

  String _formatDuration(int seconds) {
    final m = (seconds / 60).floor().toString().padLeft(2, '0');
    final s = (seconds % 60).toString().padLeft(2, '0');
    return "$m:$s";
  }

  void _showCheckoutDialog() {
    if (_selectedSlots.isEmpty) return;

    final basePrice = widget.arena.basePricePerHourPaise;
    final totalBasePaise = basePrice * _selectedSlots.length;
    const int convenienceFeePaise = 4500; // ₹45.00
    final totalPaise = totalBasePaise + convenienceFeePaise;

    bool doubleTapShield = false;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: AppColors.bgElevated,
              title: Text(
                'BOOKING CHECKOUT',
                style: AppTheme.displayStyle(fontSize: 18),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    widget.arena.name.toUpperCase(),
                    style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Sport: $_selectedSport',
                    style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Slots selected: ${_selectedSlots.length} hour(s)',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
                  Divider(color: AppColors.borderSubtle),
                  const SizedBox(height: 8),
                  
                  // Price breakdown
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Court Charges', style: TextStyle(color: AppColors.textSecondary)),
                      Text(
                        '₹${(totalBasePaise / 100).toStringAsFixed(2)}',
                        style: AppTheme.tabularStyle(color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  SizedBox(height: 6),
                   Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Platform Fee', style: TextStyle(color: AppColors.textSecondary)),
                      Text(
                        '₹${(convenienceFeePaise / 100).toStringAsFixed(2)}',
                        style: TextStyle(color: AppColors.textPrimary, fontFeatures: [FontFeature.tabularFigures()]),
                      ),
                    ],
                  ),
                  SizedBox(height: 8),
                  Divider(color: AppColors.borderSubtle),
                  SizedBox(height: 8),
                  
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Total Payable',
                        style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                      Text(
                        '₹${(totalPaise / 100).toStringAsFixed(2)}',
                        style: AppTheme.tabularStyle(
                          color: AppColors.gold,
                          fontWeight: FontWeight.bold,
                          fontSize: 18,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Double-tap protection enabled. Please confirm your reservation.',
                    style: TextStyle(color: AppColors.textMuted, fontSize: 10),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: doubleTapShield ? null : () => Navigator.pop(dialogContext),
                  child: Text('CANCEL', style: TextStyle(color: AppColors.textSecondary)),
                ),
                ElevatedButton(
                  onPressed: doubleTapShield
                      ? null
                      : () {
                          setDialogState(() {
                            doubleTapShield = true;
                          });
                          
                          // Simulate API delay
                          Future.delayed(const Duration(milliseconds: 1500), () {
                            Navigator.pop(dialogContext); // Close dialog
                            _countdownTimer?.cancel();
                            setState(() {
                              _bookedSlots.addAll(_selectedSlots);
                              _selectedSlots.clear();
                              _isSlotsHeld = false;
                            });
                            
                            AppSnackBar.showSuccess(context, 'Reserved Court for $_selectedSport successfully! Code: BXZ891');
                          });
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.volt500,
                    foregroundColor: Colors.black,
                  ),
                  child: doubleTapShield
                      ? const AppLoader(size: 16, strokeWidth: 2, color: Colors.black)
                      : Text('CONFIRM & PAY', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<String> hours = [
      "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", 
      "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", 
      "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
    ];

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(widget.arena.name.toUpperCase(), style: AppTheme.displayStyle(fontSize: 18)),
        actions: [
          IconButton(
            icon: const Icon(Icons.info_outline_rounded),
            tooltip: 'Arena Stats & Amenities',
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (_) => ArenaInfoScreen(arena: widget.arena),
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Banner & Quick stats
          ArenaImage(
            url: widget.arena.imageUrl,
            height: 180,
            borderRadius: BorderRadius.zero,
          ),
          
          // Sport Selector
          if (widget.arena.sportsSupported.isNotEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'SELECT SPORT',
                    style: AppTheme.label.copyWith(fontSize: 11, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: widget.arena.sportsSupported.map((sport) {
                      final isSelected = _selectedSport == sport;
                      return Padding(
                        key: ValueKey(sport),
                        padding: const EdgeInsets.only(right: 8.0),
                        child: ChoiceChip(
                          label: Text(sport),
                          selected: isSelected,
                          onSelected: (selected) {
                            if (selected) {
                              setState(() {
                                _selectedSport = sport;
                                _selectedSlots.clear();
                              });
                            }
                          },
                          selectedColor: AppColors.volt500,
                          backgroundColor: AppColors.bgSurface,
                          labelStyle: TextStyle(
                            color: isSelected ? Colors.black : AppColors.textSecondary,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                            side: BorderSide(
                              color: isSelected ? AppColors.volt500 : AppColors.borderSubtle,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          
          // Hold indicator
          if (_isSlotsHeld)
            Container(
              color: AppColors.dispute.withOpacity(0.15),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Slots soft-held for booking',
                    style: TextStyle(color: AppColors.dispute, fontWeight: FontWeight.bold, fontSize: 13),
                  ),
                  Text(
                    _formatDuration(_holdSecondsRemaining),
                    style: AppTheme.tabularStyle(
                      color: AppColors.dispute,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),

          // Date calendar selector
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Icon(Icons.calendar_month_rounded, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(
                  'Date: ${_selectedDate.day} Aug, 2026',
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () {
                    // Quick mock toggle next day
                    setState(() {
                      _selectedDate = _selectedDate.add(const Duration(days: 1));
                    });
                  },
                  child: Text('NEXT DAY', style: TextStyle(color: AppColors.volt500)),
                ),
                const SizedBox(width: 4),
                IconButton(
                  icon: Icon(Icons.fullscreen_rounded, color: AppColors.volt500),
                  tooltip: 'Fullscreen View',
                  onPressed: _openFullscreenTable,
                ),
              ],
            ),
          ),

          // Slots Timeline Matrix Grid
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Table(
                border: TableBorder(
                  horizontalInside: BorderSide(color: AppColors.borderSubtle, width: 0.5),
                  verticalInside: BorderSide(color: AppColors.borderSubtle, width: 0.5),
                ),
                columnWidths: const {
                  0: FlexColumnWidth(1.2), // Hour column
                  1: FlexColumnWidth(1.0),
                  2: FlexColumnWidth(1.0),
                  3: FlexColumnWidth(1.0),
                },
                children: [
                  // Table Header
                  TableRow(
                    decoration: BoxDecoration(color: AppColors.bgSurface),
                    children: [
                      TableCell(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 8.0),
                          child: Text('TIME', style: AppTheme.label),
                        ),
                      ),
                      ..._courts.map((court) {
                        return TableCell(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 12.0),
                            child: Text(
                              court.toUpperCase(),
                              textAlign: TextAlign.center,
                              style: AppTheme.label.copyWith(color: AppColors.textSecondary),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),

                  // Table Rows representing timelines
                  ...hours.map((hour) {
                    return TableRow(
                      children: [
                        TableCell(
                          verticalAlignment: TableCellVerticalAlignment.middle,
                          child: Padding(
                            padding: const EdgeInsets.only(left: 8.0),
                            child: Text(
                              hour,
                              style: AppTheme.tabularStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                        ..._courts.map((court) {
                          final slotKey = "$court-$hour";
                          final isBooked = _bookedSlots.contains(slotKey);
                          final isSelected = _selectedSlots.contains(slotKey);

                          Color cellColor = Colors.transparent;
                          Widget cellContent = SizedBox(height: 48);

                          if (isBooked) {
                            cellColor = AppColors.bgInset;
                            cellContent = Center(
                              child: Text(
                                'BOOKED',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  decoration: TextDecoration.lineThrough,
                                ),
                              ),
                            );
                          } else if (isSelected) {
                            cellColor = _isSlotsHeld ? AppColors.dispute.withOpacity(0.2) : AppColors.volt500;
                            cellContent = Center(
                              child: Text(
                                _isSlotsHeld ? 'HELD' : 'SELECTED',
                                style: TextStyle(
                                  color: _isSlotsHeld ? AppColors.dispute : AppColors.textInverse,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            );
                          }

                          return TableCell(
                            child: InkWell(
                              onTap: () => _toggleSlot(court, hour),
                              child: Container(
                                height: 48,
                                color: cellColor,
                                child: cellContent,
                              ),
                            ),
                          );
                        }),
                      ],
                    );
                  }),
                ],
              ),
            ),
          ),

          // Bottom Bar action CTA
          SafeArea(
            child: Container(
              padding: const EdgeInsets.all(16.0),
              color: AppColors.bgSurface,
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${_selectedSlots.length} slot(s) selected',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                        SizedBox(height: 4),
                        Text(
                          _selectedSlots.isEmpty
                              ? 'Select slots to reserve'
                              : 'Rate: ₹${(widget.arena.basePricePerHourPaise / 100).toStringAsFixed(0)}/hr',
                          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: 16),
                  ElevatedButton(
                    onPressed: _selectedSlots.isEmpty
                        ? null
                        : () {
                            if (!_isSlotsHeld) {
                              _startHoldTimer();
                            } else {
                              _showCheckoutDialog();
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _isSlotsHeld ? AppColors.volt500 : AppColors.dispute,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
                      shape: const StadiumBorder(),
                    ),
                    child: Text(
                      _isSlotsHeld ? 'BOOK NOW' : 'HOLD SLOTS',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
