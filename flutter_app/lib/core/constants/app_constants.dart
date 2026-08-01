import 'dart:io';

class AppConstants {
  // App Configs
  static const String appName = 'BoxArena';
  static final String apiBaseUrl = Platform.isAndroid
      ? 'http://10.0.2.2:5001/api/v1'
      : 'http://localhost:5001/api/v1';

  // Sport Types
  static const String sportCricket = 'cricket';
  static const String sportFootball = 'football';
  static const String sportBadminton = 'badminton';

  // Skill Levels
  static const String skillBeginner = 'beginner';
  static const String skillIntermediate = 'intermediate';
  static const String skillAdvanced = 'advanced';

  // Game Logic Rules
  static const int defaultElo = 1200;
  static const int badmintonMaxPoints = 21;
  static const int badmintonCapPoints = 30;
  static const int badmintonMinSetsToWin = 2;
  static const int badmintonMaxSets = 3;

  // KYC States
  static const String kycNotSubmitted = 'not_submitted';
  static const String kycPending = 'pending';
  static const String kycVerified = 'verified';

  // Payout Configs
  static const int convenienceFeePaise = 4500; // ₹45.00
  static const double platformCommissionPercent = 10.0;

  // Time Formats
  static const List<String> operationalHours = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", 
    "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", 
    "18:00", "19:00", "20:00", "21:00", "22:00", "23:00"
  ];
}
