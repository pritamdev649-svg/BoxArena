class ApiRoutes {
  static const String otpRequest = '/auth/otp/request';
  static const String otpVerify = '/auth/otp/verify';
  static const String wallet = '/wallet';
  static const String walletTransactions = '/wallet/transactions';
  static const String topupOrder = '/wallet/topup/order';
  static const String topupVerify = '/wallet/topup/verify';
  static const String challenges = '/challenges';

  // Live scoring — the official's scoreboard.
  static String matchLive(String id) => '/matches/$id/live';
  static String matchLiveStart(String id) => '/matches/$id/live/start';
  static String matchLivePoint(String id) => '/matches/$id/live/point';
  static String matchLiveUndo(String id) => '/matches/$id/live/undo';
  static String matchLiveEvent(String id) => '/matches/$id/live/event';
  static String matchLiveConfirm(String id) => '/matches/$id/live/confirm';
  static String matchLiveStats(String id) => '/matches/$id/live/stats';
  static const String officialMyMatches = '/officials/me/matches';
  static const String officials = '/officials';
  static String matchConfirmResult(String id) => '/matches/$id/result/confirm';
  static String matchOfficialFee(String id) => '/matches/$id/official-fee';
}
