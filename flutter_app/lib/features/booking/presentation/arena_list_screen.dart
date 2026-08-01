import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/mock/seed_data.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'package:app/features/booking/providers/arenas_provider.dart';
import 'arena_detail_screen.dart';
import 'package:app/core/providers/profile_provider.dart';

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
    final profile = ref.watch(profileProvider);
    final String initialLetter = (profile?.name.isNotEmpty == true)
        ? profile!.name.substring(0, 1).toUpperCase()
        : 'P';

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        toolbarHeight: 72,
        title: Row(
          children: [
            CircleAvatar(
              radius: 20,
              backgroundColor: AppColors.volt500,
              child: CircleAvatar(
                radius: 18,
                backgroundColor: AppColors.bgSurface,
                child: Text(
                  initialLetter,
                  style: TextStyle(
                    color: AppColors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 12),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.location_on_rounded,
                      size: 14,
                      color: AppColors.volt500,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'Gomti Nagar, Lucknow',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.textSecondary,
                      ),
                    ),
                    Icon(
                      Icons.keyboard_arrow_down_rounded,
                      size: 14,
                      color: AppColors.textMuted,
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Text(
                      profile?.name ?? 'Player',
                      style: AppTheme.displayStyle(fontSize: 15).copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: AppColors.voltGlow,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        (profile?.primarySport ?? 'Badminton').toUpperCase(),
                        style: TextStyle(
                          color: AppColors.volt500,
                          fontSize: 8,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: AppColors.bgInset,
                shape: BoxShape.circle,
                border: Border.all(color: AppColors.borderSubtle),
              ),
              child: Icon(
                Icons.my_location_rounded,
                color: AppColors.volt500,
                size: 18,
              ),
            ),
            onPressed: () {
              AppSnackBar.showInfo(
                context,
                'Locating nearest arenas in Lucknow...',
              );
            },
          ),
          const SizedBox(width: 8),
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
                        borderSide: BorderSide(
                          color: AppColors.volt500,
                          width: 1.5,
                        ),
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
                                    : AppColors.borderSubtle,
                              ),
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),

                // Arenas List / Dashboard Content
                Expanded(
                  child:
                      (_selectedSport != "All" ||
                          _selectedArea != "All" ||
                          _searchQuery.isNotEmpty)
                      ? _buildFilteredList(filtered)
                      : _buildDashboard(context, arenas),
                ),
              ],
            ),
          );
        },
        error: (err, stack) => Scaffold(
          body: Center(
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
                  const SizedBox(height: 12),
                  Text(
                    'Failed to load arenas',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    err.toString(),
                    textAlign: TextAlign.center,
                    style: TextStyle(color: AppColors.textMuted, fontSize: 13),
                  ),
                  const SizedBox(height: 16),
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
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.dispute),
        ),
      ),
    );
  }

  Widget _buildFilteredList(List<MockArena> filtered) {
    if (filtered.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.sports_rounded, size: 48, color: AppColors.textMuted),
            const SizedBox(height: 12),
            Text(
              'No arenas match your filters',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 16),
            ),
            const SizedBox(height: 4),
            Text(
              'Try clearing filters or search parameters',
              style: TextStyle(color: AppColors.textMuted, fontSize: 13),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      itemCount: filtered.length,
      itemBuilder: (context, index) {
        final arena = filtered[index];
        return _buildArenaListItem(arena);
      },
    );
  }

  Widget _buildArenaListItem(MockArena arena) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16.0),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: InkWell(
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => ArenaDetailScreen(arena: arena)),
          );
        },
        borderRadius: BorderRadius.circular(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Arena Image with Sport Labels
            ClipRRect(
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(16),
              ),
              child: Stack(
                children: [
                  Image.network(
                    arena.imageUrl,
                    height: 150,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      height: 150,
                      width: double.infinity,
                      color: AppColors.bgInset,
                      child: Icon(
                        Icons.image_not_supported_rounded,
                        size: 36,
                        color: AppColors.textMuted,
                      ),
                    ),
                  ),
                  // Sport badges
                  Positioned(
                    top: 10,
                    left: 10,
                    child: Row(
                      children: arena.sportsSupported.map((sport) {
                        return Container(
                          margin: const EdgeInsets.only(right: 6.0),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: Colors.black.withOpacity(0.7),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(color: AppColors.borderSubtle),
                          ),
                          child: Text(
                            sport.toUpperCase(),
                            style: TextStyle(
                              color: AppColors.volt400,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                  // Rating
                  Positioned(
                    bottom: 10,
                    right: 10,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.black.withOpacity(0.65),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.star_rounded,
                            color: AppColors.gold,
                            size: 14,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            arena.rating.toString(),
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
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
                horizontal: 14.0,
                vertical: 12.0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    arena.name.toUpperCase(),
                    style: AppTheme.displayStyle(fontSize: 15).copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 12,
                        color: AppColors.textSecondary,
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          arena.location,
                          style: AppTheme.bodySecondary.copyWith(fontSize: 11),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  // Price and Amenities
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      // Amenities list (first 2)
                      Row(
                        children: arena.amenities.take(2).map((amenity) {
                          return Container(
                            margin: const EdgeInsets.only(right: 6.0),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.bgInset,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              amenity,
                              style: TextStyle(
                                color: AppColors.textSecondary,
                                fontSize: 10,
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      // Tabular numbers for price
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.voltGlow,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              '₹${(arena.basePricePerHourPaise / 100).toStringAsFixed(0)}',
                              style: AppTheme.tabularStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                color: AppColors.volt500,
                              ),
                            ),
                            Text(
                              '/hr',
                              style: TextStyle(
                                color: AppColors.volt500.withOpacity(0.8),
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
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
  }

  Widget _buildDashboard(BuildContext context, List<MockArena> arenas) {
    final profile = ref.watch(profileProvider);
    final userElo = profile?.eloRating ?? 1200;
    final activeChallengesCount = SeedData.challenges.length;

    return ListView(
      padding: const EdgeInsets.symmetric(vertical: 12.0),
      children: [
        _buildSummaryStats(context, activeChallengesCount, userElo),
        _buildTopPlayersSection(),
        _buildFeaturedArenasSection(arenas),
        _buildRecentChallengesSection(),
      ],
    );
  }

  Widget _buildSummaryStats(
    BuildContext context,
    int activeChallengesCount,
    int userElo,
  ) {
    return Container(
      height: 96,
      margin: const EdgeInsets.only(bottom: 20.0),
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16.0),
        children: [
          _buildStatCard(
            'ACTIVE MATCHES',
            '$activeChallengesCount Open',
            Icons.sports_esports_rounded,
            AppColors.volt500,
          ),
          const SizedBox(width: 10),
          _buildStatCard(
            'MY RATING',
            '$userElo ELO',
            Icons.flash_on_rounded,
            AppColors.gold,
          ),
          const SizedBox(width: 10),
          _buildStatCard(
            'CITY HUB',
            'Lucknow',
            Icons.location_on_rounded,
            AppColors.info,
          ),
        ],
      ),
    );
  }

  Widget _buildStatCard(
    String label,
    String value,
    IconData icon,
    Color color,
  ) {
    return Container(
      width: 135,
      padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: AppColors.bgSurface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.borderSubtle),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 8,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(6),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const Spacer(),
          Text(
            label,
            style: TextStyle(
              color: AppColors.textMuted,
              fontSize: 9,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: TextStyle(
              color: AppColors.textPrimary,
              fontSize: 15,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopPlayersSection() {
    final players = SeedData.players;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('TOP LOCAL PLAYERS', style: AppTheme.label),
              Text(
                'ACTIVE NOW',
                style: TextStyle(
                  color: AppColors.win,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
          height: 96,
          margin: const EdgeInsets.only(bottom: 24.0),
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            itemCount: players.length,
            itemBuilder: (context, index) {
              final player = players[index];
              return Container(
                width: 170,
                margin: const EdgeInsets.only(right: 12.0),
                padding: const EdgeInsets.all(12.0),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderSubtle),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.02),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.volt500.withOpacity(0.4),
                          width: 1.5,
                        ),
                      ),
                      child: CircleAvatar(
                        radius: 20,
                        backgroundImage: NetworkImage(player.avatarUrl),
                        backgroundColor: AppColors.bgInset,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            player.fullName,
                            style: TextStyle(
                              color: AppColors.textPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          Text(
                            player.primarySport,
                            style: TextStyle(
                              color: AppColors.textSecondary,
                              fontSize: 10,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 4),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.voltGlow,
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.flash_on_rounded,
                                  size: 10,
                                  color: AppColors.volt500,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  '${player.eloRating}',
                                  style: AppTheme.tabularStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.volt500,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildFeaturedArenasSection(List<MockArena> arenas) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('FEATURED SPORTS VENUES', style: AppTheme.label),
              Text(
                'VIEW ALL',
                style: TextStyle(
                  color: AppColors.volt500,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        Container(
          height: 220,
          margin: const EdgeInsets.only(bottom: 24.0),
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16.0),
            itemCount: arenas.length,
            itemBuilder: (context, index) {
              final arena = arenas[index];
              return Container(
                width: 230,
                margin: const EdgeInsets.only(right: 14.0),
                decoration: BoxDecoration(
                  color: AppColors.bgSurface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.borderSubtle),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.03),
                      blurRadius: 10,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ArenaDetailScreen(arena: arena),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Expanded(
                        child: ClipRRect(
                          borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(16),
                          ),
                          child: Stack(
                            fit: StackFit.expand,
                            children: [
                              Image.network(
                                arena.imageUrl,
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => Container(
                                  color: AppColors.bgInset,
                                  child: Icon(
                                    Icons.image_not_supported_rounded,
                                    size: 32,
                                    color: AppColors.textMuted,
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 10,
                                right: 10,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withOpacity(0.65),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      const Icon(
                                        Icons.star_rounded,
                                        size: 13,
                                        color: AppColors.gold,
                                      ),
                                      const SizedBox(width: 2),
                                      Text(
                                        '${arena.rating}',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                              Positioned(
                                bottom: 10,
                                left: 10,
                                child: Row(
                                  children: arena.sportsSupported.map((sport) {
                                    return Container(
                                      margin: const EdgeInsets.only(right: 4),
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 6,
                                        vertical: 3,
                                      ),
                                      decoration: BoxDecoration(
                                        color: AppColors.bgSurface.withOpacity(0.9),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        sport.toUpperCase(),
                                        style: TextStyle(
                                          color: AppColors.textPrimary,
                                          fontSize: 8,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              arena.name.toUpperCase(),
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Icon(
                                  Icons.location_on_outlined,
                                  size: 11,
                                  color: AppColors.textSecondary,
                                ),
                                const SizedBox(width: 2),
                                Expanded(
                                  child: Text(
                                    arena.location,
                                    style: TextStyle(
                                      color: AppColors.textSecondary,
                                      fontSize: 10,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Starting from',
                                  style: TextStyle(
                                    color: AppColors.textMuted,
                                    fontSize: 9,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    color: AppColors.voltGlow,
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    '₹${(arena.basePricePerHourPaise / 100).toStringAsFixed(0)}/hr',
                                    style: AppTheme.tabularStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      color: AppColors.volt500,
                                    ),
                                  ),
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
    );
  }

  Widget _buildRecentChallengesSection() {
    final challenges = SeedData.challenges;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('ACTIVE MATCH CHALLENGES', style: AppTheme.label),
              Text(
                'LIVE MATCHES',
                style: TextStyle(
                  color: AppColors.loss,
                  fontSize: 9,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        ListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          itemCount: challenges.length,
          itemBuilder: (context, index) {
            final challenge = challenges[index];
            final isCricket = challenge.sport.toLowerCase().contains('cricket');

            return Container(
              margin: const EdgeInsets.only(bottom: 12.0),
              padding: const EdgeInsets.symmetric(horizontal: 14.0, vertical: 12.0),
              decoration: BoxDecoration(
                color: AppColors.bgSurface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.borderSubtle),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.02),
                    blurRadius: 8,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(
                        color: (isCricket ? AppColors.sportCricket : AppColors.volt500).withOpacity(0.3),
                        width: 1.5,
                      ),
                    ),
                    child: CircleAvatar(
                      radius: 18,
                      backgroundColor: isCricket
                          ? AppColors.sportCricket.withOpacity(0.1)
                          : AppColors.voltGlow,
                      child: Text(
                        challenge.creatorCaptainName
                            .substring(0, 1)
                            .toUpperCase(),
                        style: TextStyle(
                          color: isCricket
                              ? AppColors.sportCricket
                              : AppColors.volt500,
                          fontWeight: FontWeight.bold,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Text(
                              challenge.creatorTeamName,
                              style: TextStyle(
                                color: AppColors.textPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 5,
                                vertical: 1.5,
                              ),
                              decoration: BoxDecoration(
                                color: isCricket
                                    ? AppColors.sportCricket.withOpacity(0.1)
                                    : AppColors.voltGlow,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                challenge.sport.toUpperCase(),
                                style: TextStyle(
                                  color: isCricket
                                      ? AppColors.sportCricket
                                      : AppColors.volt500,
                                  fontSize: 7,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 3),
                        Row(
                          children: [
                            Icon(
                              Icons.sports_soccer_rounded,
                              size: 11,
                              color: AppColors.textMuted,
                            ),
                            const SizedBox(width: 2),
                            Expanded(
                              child: Text(
                                challenge.arenaName,
                                style: TextStyle(
                                  color: AppColors.textSecondary,
                                  fontSize: 10,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.gold.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          '₹${(challenge.prizePoolPaise / 100).toStringAsFixed(0)}',
                          style: AppTheme.tabularStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: AppColors.gold,
                          ),
                        ),
                      ),
                      const SizedBox(height: 2),
                      const Text(
                        'PRIZE POOL',
                        style: TextStyle(
                          color: AppColors.gold,
                          fontSize: 7,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 0.3,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          },
        ),
      ],
    );
  }
}
