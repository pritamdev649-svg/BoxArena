import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/models/arena.dart';

final arenasProvider = FutureProvider<List<Arena>>((ref) async {
  final apiClient = ref.read(apiClientProvider);
  final response = await apiClient.get('/arenas');
  
  final List<dynamic> data = response['data'] ?? response;
  return data.map((json) {
    final publicId = json['publicId'] as String? ?? '';
    final name = json['name'] as String? ?? '';
    
    final address = json['address'] as Map<String, dynamic>? ?? {};
    final areaName = address['areaName'] as String? ?? '';
    final formattedAddress = address['formattedAddress'] as String? ?? '';
    final locationStr = formattedAddress.isNotEmpty ? formattedAddress : "$areaName, Lucknow";

    final ratingObj = json['rating'] as Map<String, dynamic>? ?? {};
    /// 0.0, not 4.0. An unreviewed venue has no rating, and inventing a
    /// flattering default is the exact thing the review system exists to stop.
    final rating = (ratingObj['average'] as num?)?.toDouble() ?? 0.0;
    final reviewsCount = (ratingObj['count'] as num?)?.toInt() ?? 0;

    final sportsList = json['sportsSupported'] as List<dynamic>? ?? [];
    final sportsSupported = sportsList.map((s) {
      final sStr = s.toString().toLowerCase();
      if (sStr == 'badminton') return 'Badminton';
      if (sStr == 'cricket') return 'Box Cricket';
      if (sStr == 'football') return 'Turf Football';
      return s.toString();
    }).toList();

    final amenitiesList = json['amenities'] as List<dynamic>? ?? [];
    final amenities = amenitiesList.map((a) {
      final aStr = a.toString().toLowerCase();
      if (aStr == 'parking') return 'Parking';
      if (aStr == 'washroom') return 'Washroom';
      if (aStr == 'floodlights') return 'Floodlights';
      if (aStr == 'changing_room') return 'Changing Room';
      if (aStr == 'cafeteria') return 'Cafeteria';
      if (aStr == 'cctv') return 'CCTV';
      if (aStr == 'first_aid') return 'First Aid';
      if (aStr == 'equipment_rental') return 'Equipment Rental';
      return a.toString();
    }).toList();

    final courtsList = json['courts'] as List<dynamic>? ?? [];
    int basePrice = 100000;
    if (courtsList.isNotEmpty) {
      final prices = courtsList
          .map((c) => (c['basePricePerHourPaise'] as num?)?.toInt() ?? 100000)
          .toList();
      basePrice = prices.reduce((a, b) => a < b ? a : b);
    }

    /// Null when the owner has not uploaded one — the widget draws a
    /// placeholder rather than a stock photo of somebody else's venue.
    final imagesList = json['images'] as List<dynamic>? ?? [];
    final imageUrl = imagesList.isNotEmpty ? imagesList.first as String : null;

    return Arena(
      publicId: publicId,
      name: name,
      location: locationStr,
      areaName: areaName,
      rating: rating,
      reviewsCount: reviewsCount,
      sportsSupported: sportsSupported,
      amenities: amenities,
      basePricePerHourPaise: basePrice,
      imageUrl: imageUrl,
    );
  }).toList();
});
