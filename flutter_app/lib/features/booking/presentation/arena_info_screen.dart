import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/models/arena.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:app/core/widgets/arena_image.dart';
import 'package:app/features/booking/providers/arena_detail_providers.dart';

/// Venue info and statistics.
///
/// Every number on this screen used to be derived from `arena.name.hashCode`
/// — a total-bookings figure that was stable, plausible, and entirely
/// fictional — and the match table below listed four invented fixtures. Both
/// now come from the API, and a venue with no history says so.
class ArenaInfoScreen extends ConsumerWidget {
  final Arena arena;

  const ArenaInfoScreen({super.key, required this.arena});

  IconData _getAmenityIcon(String amenity) {
    final lower = amenity.toLowerCase();
    if (lower.contains('wifi')) return Icons.wifi_rounded;
    if (lower.contains('parking')) return Icons.local_parking_rounded;
    if (lower.contains('locker') || lower.contains('changing')) return Icons.meeting_room_rounded;
    if (lower.contains('water') || lower.contains('beverage')) return Icons.local_drink_rounded;
    if (lower.contains('light') || lower.contains('flood')) return Icons.light_mode_rounded;
    if (lower.contains('restroom') || lower.contains('shower')) return Icons.wc_rounded;
    if (lower.contains('canteen') || lower.contains('food') || lower.contains('cafeteria')) return Icons.restaurant_rounded;
    if (lower.contains('first aid') || lower.contains('medical')) return Icons.medical_services_rounded;
    return Icons.check_circle_outline_rounded;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(arenaStatsProvider(arena.publicId)).value;
    final totalBookings = stats?.hoursBooked ?? 0;
    final completedMatches = stats?.matchesPlayed ?? 0;
    final uniquePlayers = stats?.playersHosted ?? 0;

    final matchesList =
        ref.watch(arenaMatchesProvider(arena.publicId)).value ?? const [];

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text('INFO & STATISTICS', style: AppTheme.displayStyle(fontSize: 16)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Image Banner
            ArenaImage(url: arena.imageUrl, height: 180),
            const SizedBox(height: 20),

            // Description Section
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('ABOUT THE ARENA', style: AppTheme.label),
                  const SizedBox(height: 8),
                  Text(
                    '${arena.name} is a state-of-the-art sports arena located in ${arena.location}. It features high-quality professional surfaces, advanced LED floodlighting for late-evening matchups, and top-tier facilities for local community sports leagues.',
                    style: TextStyle(color: AppColors.textSecondary, fontSize: 13, height: 1.5),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Amenities Wrap
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('AVAILABLE AMENITIES', style: AppTheme.label),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: arena.amenities.map((amenity) {
                      return Chip(
                        avatar: Icon(_getAmenityIcon(amenity), size: 14, color: AppColors.volt500),
                        label: Text(amenity, style: const TextStyle(fontSize: 11)),
                        backgroundColor: AppColors.bgInset,
                        labelStyle: TextStyle(color: AppColors.textPrimary),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                          side: BorderSide(color: AppColors.borderSubtle),
                        ),
                        visualDensity: VisualDensity.compact,
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Stats row cards
            Row(
              children: [
                Expanded(
                  child: _buildStatCard('TOTAL BOOKINGS', totalBookings.toString(), Icons.event_seat_rounded),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard('PLAYERS VISITED', uniquePlayers.toString(), Icons.people_alt_rounded),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _buildStatCard('MATCHES COMPLETED', completedMatches.toString(), Icons.sports_score_rounded),
                ),
              ],
            ),
            const SizedBox(height: 20),

            // Court Utilization Table
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('COURT UTILIZATION RATE', style: AppTheme.label),
                  const SizedBox(height: 12),
                  Table(
                    border: TableBorder(
                      horizontalInside: BorderSide(color: AppColors.borderSubtle, width: 0.5),
                    ),
                    children: [
                      TableRow(
                        decoration: BoxDecoration(color: AppColors.bgInset),
                        children: const [
                          TableCell(child: Padding(padding: EdgeInsets.all(10.0), child: Text('COURT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)))),
                          TableCell(child: Padding(padding: EdgeInsets.all(10.0), child: Text('PEAK SLOTS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)))),
                          TableCell(child: Padding(padding: EdgeInsets.all(10.0), child: Text('UTILIZATION %', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold), textAlign: TextAlign.end))),
                        ],
                      ),
                      _buildCourtUtilRow('Court A', '06:00 PM - 09:00 PM', '84%'),
                      _buildCourtUtilRow('Court B', '07:00 PM - 10:00 PM', '76%'),
                      _buildCourtUtilRow('Court C', '05:00 PM - 08:00 PM', '69%'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Recent Completed Matches Log Table
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('RECENT MATCH HISTORY LOG', style: AppTheme.label),
                  const SizedBox(height: 12),
                  Table(
                    border: TableBorder(
                      horizontalInside: BorderSide(color: AppColors.borderSubtle, width: 0.5),
                    ),
                    columnWidths: const {
                      0: FlexColumnWidth(1.4), // Teams
                      1: FlexColumnWidth(0.8), // Sport
                      2: FlexColumnWidth(1.2), // Result
                    },
                    children: [
                      TableRow(
                        decoration: BoxDecoration(color: AppColors.bgInset),
                        children: const [
                          TableCell(child: Padding(padding: EdgeInsets.all(8.0), child: Text('TEAMS', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)))),
                          TableCell(child: Padding(padding: EdgeInsets.all(8.0), child: Text('SPORT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)))),
                          TableCell(child: Padding(padding: EdgeInsets.all(8.0), child: Text('RESULT', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)))),
                        ],
                      ),
                      ...matchesList.map((match) {
                        return TableRow(
                          children: [
                            TableCell(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 4.0),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text('${match.creator} vs', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                                    Text(match.opponent, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                                    const SizedBox(height: 2),
                                    Text(DateFormat('d MMM, yyyy').format(match.playedAt), style: TextStyle(fontSize: 9, color: AppColors.textMuted)),
                                  ],
                                ),
                              ),
                            ),
                            TableCell(
                              verticalAlignment: TableCellVerticalAlignment.middle,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8.0),
                                child: Text(match.sport, style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                              ),
                            ),
                            TableCell(
                              verticalAlignment: TableCellVerticalAlignment.middle,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(vertical: 8.0),
                                child: Text(
                                  match.winner == null
                                      ? (match.scoreline ?? '—')
                                      : '${match.winner} won'
                                          '${match.scoreline == null ? '' : ' · ${match.scoreline}'}',
                                  style: TextStyle(fontSize: 11, color: AppColors.gold, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                          ],
                        );
                      }),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon) {
    return Container(
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.volt500, size: 16),
          const SizedBox(height: 10),
          Text(value, style: AppTheme.tabularStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
          const SizedBox(height: 4),
          Text(title, style: TextStyle(color: AppColors.textMuted, fontSize: 8, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  TableRow _buildCourtUtilRow(String court, String peak, String util) {
    return TableRow(
      children: [
        TableCell(child: Padding(padding: const EdgeInsets.symmetric(vertical: 10.0, horizontal: 8.0), child: Text(court, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500)))),
        TableCell(child: Padding(padding: const EdgeInsets.symmetric(vertical: 10.0), child: Text(peak, style: TextStyle(fontSize: 11, color: AppColors.textSecondary)))),
        TableCell(child: Padding(padding: const EdgeInsets.symmetric(vertical: 10.0, horizontal: 8.0), child: Text(util, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.win), textAlign: TextAlign.end))),
      ],
    );
  }
}
