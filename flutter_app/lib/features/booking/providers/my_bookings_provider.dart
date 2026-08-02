import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/services/api_client.dart';

/// A booking the signed-in player holds — `GET /bookings`.
///
/// A challenge cannot exist without one of these: the court has to be paid for
/// before anyone can be invited to play on it.
class MyBooking {
  final String publicId;
  final String arenaName;
  final String courtName;
  final String sport;
  final DateTime startAt;
  final DateTime endAt;
  final String status;

  const MyBooking({
    required this.publicId,
    required this.arenaName,
    required this.courtName,
    required this.sport,
    required this.startAt,
    required this.endAt,
    required this.status,
  });

  bool get isUpcoming => startAt.isAfter(DateTime.now());

  /// Only a confirmed, future booking can back a challenge.
  bool get canHostChallenge => isUpcoming && status == 'confirmed';

  factory MyBooking.fromJson(Map<String, dynamic> json) {
    final arena = json['arenaId'] as Map<String, dynamic>? ?? const {};
    final court = json['courtId'] as Map<String, dynamic>? ?? const {};
    return MyBooking(
      publicId: json['publicId'] as String? ?? '',
      arenaName: arena['name'] as String? ?? 'Venue',
      courtName: court['name'] as String? ?? 'Court',
      sport: court['sport'] as String? ?? '',
      startAt: DateTime.parse(json['startAt'] as String).toLocal(),
      endAt: DateTime.parse(json['endAt'] as String).toLocal(),
      status: json['status'] as String? ?? '',
    );
  }
}

final myBookingsProvider =
    FutureProvider.autoDispose<List<MyBooking>>((ref) async {
  final client = ref.read(apiClientProvider);
  final response = await client.get(ApiRoutes.myBookings);
  final List<dynamic> data = response['data'] ?? response;
  return data
      .map((json) => MyBooking.fromJson(json as Map<String, dynamic>))
      .toList();
});
