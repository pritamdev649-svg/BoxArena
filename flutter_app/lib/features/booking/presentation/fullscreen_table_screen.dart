import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';

class FullscreenTableScreen extends StatefulWidget {
  final List<String> courts;
  final List<String> hours;
  final Set<String> selectedSlots;
  final Set<String> bookedSlots;
  final bool isSlotsHeld;
  final Function(String court, String hour) onSlotToggled;

  const FullscreenTableScreen({
    super.key,
    required this.courts,
    required this.hours,
    required this.selectedSlots,
    required this.bookedSlots,
    required this.isSlotsHeld,
    required this.onSlotToggled,
  });

  @override
  State<FullscreenTableScreen> createState() => _FullscreenTableScreenState();
}

class _FullscreenTableScreenState extends State<FullscreenTableScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text('TIMELINE MATRIX (FULLSCREEN)', style: AppTheme.displayStyle(fontSize: 14)),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('APPLY', style: TextStyle(color: AppColors.volt500, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Sub-bar showing count
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: AppColors.bgSurface,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${widget.selectedSlots.length} slot(s) selected',
                  style: TextStyle(color: AppColors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                ),
                Text(
                  'Tap slots to select/unselect',
                  style: TextStyle(color: AppColors.textMuted, fontSize: 11),
                ),
              ],
            ),
          ),
          
          // Large Table Grid
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(12.0),
              child: Table(
                border: TableBorder(
                  horizontalInside: BorderSide(color: AppColors.borderSubtle, width: 0.5),
                  verticalInside: BorderSide(color: AppColors.borderSubtle, width: 0.5),
                ),
                columnWidths: const {
                  0: FlexColumnWidth(1.0), // Hour
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
                          padding: const EdgeInsets.symmetric(vertical: 14.0, horizontal: 8.0),
                          child: Text('TIME', style: AppTheme.label),
                        ),
                      ),
                      ...widget.courts.map((court) {
                        return TableCell(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 14.0),
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
                  ...widget.hours.map((hour) {
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
                        ...widget.courts.map((court) {
                          final key = "$court-$hour";
                          final isBooked = widget.bookedSlots.contains(key);
                          final isSelected = widget.selectedSlots.contains(key);

                          Color cellColor = Colors.transparent;
                          String statusText = "";
                          TextStyle textStyle = TextStyle(color: AppColors.textMuted, fontSize: 11);

                          if (isBooked) {
                            statusText = "BOOKED";
                            textStyle = const TextStyle(color: Colors.white24, fontSize: 10, decoration: TextDecoration.lineThrough);
                          } else if (isSelected) {
                            statusText = "SELECTED";
                            cellColor = AppColors.volt500;
                            textStyle = const TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 10);
                          }

                          return TableCell(
                            child: InkWell(
                              onTap: isBooked ? null : () {
                                widget.onSlotToggled(court, hour);
                                setState(() {}); // Refresh local UI immediately
                              },
                              child: Container(
                                color: cellColor,
                                height: 44,
                                alignment: Alignment.center,
                                child: Text(
                                  statusText,
                                  style: textStyle,
                                ),
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
        ],
      ),
    );
  }
}
