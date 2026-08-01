import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/mock/seed_data.dart';

final arenasProvider = FutureProvider<List<MockArena>>((ref) async {
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
    final rating = (ratingObj['average'] as num?)?.toDouble() ?? 4.0;
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

    final imagesList = json['images'] as List<dynamic>? ?? [];
    final imageUrl = imagesList.isNotEmpty
        ? imagesList.first as String
        : "https://images.unsplash.com/photo-1540747737956-37872404f802?q=80&w=600";

    return MockArena(
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
