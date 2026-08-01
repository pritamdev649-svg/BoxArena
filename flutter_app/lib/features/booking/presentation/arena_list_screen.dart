import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/mock/seed_data.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'package:app/features/booking/providers/arenas_provider.dart';
import 'arena_detail_screen.dart';

class ArenaListScreen extends ConsumerStatefulWidget {
  const ArenaListScreen({super.key});

  @override
  ConsumerState<ArenaListScreen> createState() => _ArenaListScreenState();
}

class _ArenaListScreenState extends ConsumerState<ArenaListScreen> {
  String _selectedSport = "All";
  String _selectedArea = "All";
  String _searchQuery = "";

  final List<String> _sports = [
    "All",
    "Badminton",
    "Box Cricket",
    "Turf Football",
  ];
  final List<String> _areas = [
    "All",
    "Gomti Nagar",
    "Aliganj",
    "Hazratganj",
    "Indira Nagar",
  ];

  List<MockArena> _filteredArenas(List<MockArena> arenas) {
    return arenas.where((arena) {
      final matchesSport =
          _selectedSport == "All" ||
          arena.sportsSupported.contains(_selectedSport);
      final matchesArea =
          _selectedArea == "All" || arena.areaName == _selectedArea;
      final matchesSearch =
          arena.name.toLowerCase().contains(_searchQuery.toLowerCase()) ||
          arena.location.toLowerCase().contains(_searchQuery.toLowerCase());
      return matchesSport && matchesArea && matchesSearch;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final arenasAsync = ref.watch(arenasProvider);

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(
          'DISCOVER ARENAS',
          style: AppTheme.displayStyle(fontSize: 20),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.my_location_rounded, color: AppColors.volt500),
            onPressed: () {
              AppSnackBar.showInfo(
                context,
                'Locating nearest arenas in Lucknow...',
              );
            },
          ),
        ],
      ),
      body: arenasAsync.when(
        data: (arenas) {
          final filtered = _filteredArenas(arenas);
          return RefreshIndicator(
            onRefresh: () => ref.refresh(arenasProvider.future),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Search Bar
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16.0,
                    vertical: 8.0,
                  ),
                  child: TextField(
                    onChanged: (val) => setState(() => _searchQuery = val),
                    decoration: InputDecoration(
                      hintText: 'Search Gomti Nagar, Aliganj, sports...',
                      prefixIcon: Icon(
                        Icons.search_rounded,
                        color: AppColors.textMuted,
                      ),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(30),
                        borderSide: BorderSide(color: AppColors.borderSubtle),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(30),
                        borderSide: BorderSide(color: AppColors.borderSubtle),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(30),
                        borderSide: BorderSide(color: AppColors.volt500, width: 1.5),
                      ),
                    ),
                    style: TextStyle(color: AppColors.textPrimary),
                  ),
                ),

                // Filters row
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16.0,
                    vertical: 8.0,
                  ),
                  child: Row(
                    children: [
                      // Area Selector Dropdown
                      Container(
                        height: 36,
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        decoration: BoxDecoration(
                          color: AppColors.bgInset,
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: AppColors.borderSubtle),
                        ),
                        child: DropdownButtonHideUnderline(
                          child: DropdownButton<String>(
                            value: _selectedArea,
                            isDense: true,
                            dropdownColor: AppColors.bgElevated,
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 13,
                            ),
                            items: _areas.map((area) {
                              return DropdownMenuItem<String>(
                                value: area,
                                child: Text(area),
                              );
                            }).toList(),
                            onChanged: (val) {
                              if (val != null)
                                setState(() => _selectedArea = val);
                            },
                          ),
                        ),
                      ),
                      SizedBox(width: 8),

                      // Sport Filter Chips
                      ..._sports.map((sport) {
                        final isSelected = _selectedSport == sport;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          key: ValueKey(sport),
                          child: ChoiceChip(
                            label: Text(sport),
                            selected: isSelected,
                            showCheckmark: false,
                            onSelected: (selected) {
                              if (selected)
                                setState(() => _selectedSport = sport);
                            },
                            selectedColor: AppColors.volt500,
                            backgroundColor: AppColors.bgInset,
                            labelStyle: TextStyle(
                              color: isSelected
                                  ? AppColors.textInverse
                                  : AppColors.textSecondary,
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(20),
                              side: BorderSide(
                                  color: isSelected
                                      ? AppColors.volt500
                                      : AppColors.borderSubtle),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),

                // Arenas List
                Expanded(
                  child: filtered.isEmpty
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(
                                Icons.sports_rounded,
                                size: 48,
                                color: AppColors.textMuted,
                              ),
                              SizedBox(height: 12),
                              Text(
                                'No arenas match your filters',
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 16,
                                ),
                              ),
                              SizedBox(height: 4),
                              Text(
                                'Try clearing filters or search parameters',
                                style: TextStyle(
                                  color: AppColors.textMuted,
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        )
                      : ListView.builder(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16.0,
                            vertical: 8.0,
                          ),
                          itemCount: filtered.length,
                          itemBuilder: (context, index) {
                            final arena = filtered[index];
                            return Container(
                              margin: const EdgeInsets.only(bottom: 16.0),
                              decoration: BoxDecoration(
                                color: AppColors.bgSurface,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: AppColors.borderSubtle,
                                ),
                              ),
                              child: InkWell(
                                onTap: () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) =>
                                          ArenaDetailScreen(arena: arena),
                                    ),
                                  );
                                },
                                borderRadius: BorderRadius.circular(12),
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    // Arena Image with Sport Labels
                                    ClipRRect(
                                      borderRadius: const BorderRadius.vertical(
                                        top: Radius.circular(12),
                                      ),
                                      child: Stack(
                                        children: [
                                          Image.network(
                                            arena.imageUrl,
                                            height: 130,
                                            width: double.infinity,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => Container(
                                              height: 130,
                                              width: double.infinity,
                                              color: AppColors.bgInset,
                                              child: Icon(
                                                Icons
                                                    .image_not_supported_rounded,
                                                size: 36,
                                                color: AppColors.textMuted,
                                              ),
                                            ),
                                          ),
                                          // Sport badges
                                          Positioned(
                                            top: 8,
                                            left: 8,
                                            child: Row(
                                              children: arena.sportsSupported.map((
                                                sport,
                                              ) {
                                                return Container(
                                                  margin: const EdgeInsets.only(
                                                    right: 6.0,
                                                  ),
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 8,
                                                        vertical: 4,
                                                      ),
                                                  decoration: BoxDecoration(
                                                    color: Colors.black
                                                        .withOpacity(0.7),
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          4,
                                                        ),
                                                    border: Border.all(
                                                      color: AppColors
                                                          .borderSubtle,
                                                    ),
                                                  ),
                                                  child: Text(
                                                    sport.toUpperCase(),
                                                    style: TextStyle(
                                                      color: AppColors.volt400,
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                                );
                                              }).toList(),
                                            ),
                                          ),
                                          // Rating
                                          Positioned(
                                            bottom: 8,
                                            right: 8,
                                            child: Container(
                                              padding:
                                                  const EdgeInsets.symmetric(
                                                    horizontal: 6,
                                                    vertical: 3,
                                                  ),
                                              decoration: BoxDecoration(
                                                color: AppColors.bgBase
                                                    .withOpacity(0.85),
                                                borderRadius:
                                                    BorderRadius.circular(6),
                                              ),
                                              child: Row(
                                                children: [
                                                  Icon(
                                                    Icons.star_rounded,
                                                    color: AppColors.gold,
                                                    size: 14,
                                                  ),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    arena.rating.toString(),
                                                    style: TextStyle(
                                                      color:
                                                          AppColors.textPrimary,
                                                      fontSize: 11,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),

                                    // Info details
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 12.0,
                                        vertical: 10.0,
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            arena.name.toUpperCase(),
                                            style: AppTheme.displayStyle(
                                              fontSize: 16,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            arena.location,
                                            style: AppTheme.bodySecondary
                                                .copyWith(fontSize: 12),
                                          ),
                                          const SizedBox(height: 8),
                                          // Price and Amenities
                                          Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              // Amenities list (first 2)
                                              Row(
                                                children: arena.amenities.take(2).map((
                                                  amenity,
                                                ) {
                                                  return Container(
                                                    margin:
                                                        const EdgeInsets.only(
                                                          right: 6.0,
                                                        ),
                                                    padding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 6,
                                                          vertical: 2,
                                                        ),
                                                    decoration: BoxDecoration(
                                                      color: AppColors.bgInset,
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            4,
                                                          ),
                                                    ),
                                                    child: Text(
                                                      amenity,
                                                      style: TextStyle(
                                                        color: AppColors
                                                            .textSecondary,
                                                        fontSize: 11,
                                                      ),
                                                    ),
                                                  );
                                                }).toList(),
                                              ),
                                              // Tabular numbers for price
                                              Row(
                                                crossAxisAlignment:
                                                    CrossAxisAlignment.baseline,
                                                textBaseline:
                                                    TextBaseline.alphabetic,
                                                children: [
                                                  Text(
                                                    '₹${(arena.basePricePerHourPaise / 100).toStringAsFixed(0)}',
                                                    style:
                                                        AppTheme.tabularStyle(
                                                          fontSize: 16,
                                                          fontWeight:
                                                              FontWeight.bold,
                                                          color:
                                                              AppColors.volt500,
                                                        ),
                                                  ),
                                                  Text(
                                                    '/hr',
                                                    style: TextStyle(
                                                      color:
                                                          AppColors.textMuted,
                                                      fontSize: 12,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            );
                          },
                        ),
                ),
              ],
            ),
          );
        },
        loading: () =>
            Center(child: CircularProgressIndicator(color: AppColors.volt500)),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.error_outline_rounded,
                  size: 48,
                  color: AppColors.loss,
                ),
                SizedBox(height: 12),
                Text(
                  'Failed to load arenas',
                  style: TextStyle(
                    color: AppColors.textSecondary,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  err.toString(),
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                ),
                SizedBox(height: 16),
                ElevatedButton(
                  onPressed: () => ref.refresh(arenasProvider),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.volt500,
                    foregroundColor: AppColors.textInverse,
                  ),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
