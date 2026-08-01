import 'dart:convert';
import 'dart:developer';
import 'package:flutter/services.dart';

class AppLocalizations {
  final String locale;
  late final Map<String, String> _translations;

  AppLocalizations(this.locale) {
    // Read from the preloaded static map cache
    final rawJson = _preloadedTranslations[locale] ?? _preloadedTranslations['en'] ?? '{}';
    _translations = Map<String, String>.from(jsonDecode(rawJson));
  }

  // Preloaded translations cache to allow synchronous lookups in UI widgets
  static final Map<String, String> _preloadedTranslations = {};

  // Preloads the JSON files from the assets folder at app startup
  static Future<void> preloadAll() async {
    try {
      _preloadedTranslations['en'] = await rootBundle.loadString('assets/lang/en.json');
      _preloadedTranslations['hi'] = await rootBundle.loadString('assets/lang/hi.json');
      log('Localization files loaded successfully from assets.');
    } catch (e) {
      log('Error preloading localizations: $e. Falling back to inline assets.');
      // Dynamic fallback defaults for testing environments
      _preloadedTranslations['en'] = _fallbackEnJson;
      _preloadedTranslations['hi'] = _fallbackHiJson;
    }
  }

  String _translate(String key) {
    return _translations[key] ?? key;
  }

  // Getters for translations
  String get discoverArenas => _translate('discover_arenas');
  String get matchmakingFeed => _translate('matchmaking_feed');
  String get walletLedger => _translate('wallet_ledger');
  String get profileTools => _translate('profile_tools');
  String get totalBalance => _translate('total_balance');
  String get deposits => _translate('deposits');
  String get winnings => _translate('winnings');
  String get bonus => _translate('bonus');
  String get kycStatus => _translate('kyc_status');
  String get notVerified => _translate('not_verified');
  String get pendingReview => _translate('pending_review');
  String get verified => _translate('verified');
  String get depositFunds => _translate('deposit_funds');
  String get withdrawal => _translate('withdrawal');
  String get recordScore => _translate('record_score');
  String get validateSubmit => _translate('validate_submit');
  String get prizePool => _translate('prize_pool');
  String get entryFee => _translate('entry_fee');
  String get accept => _translate('accept');
  String get cancel => _translate('cancel');
  String get confirm => _translate('confirm');
  String get insufficientBalance => _translate('insufficient_balance');
  String get kycRequired => _translate('kyc_required');

  // Tab translations
  String get tabDiscover => _translate('tab_discover');
  String get tabChallenges => _translate('tab_challenges');
  String get tabWallet => _translate('tab_wallet');
  String get tabProfile => _translate('tab_profile');

  // Inline Fallbacks (only used if asset loading fails during testing or asset bundle errors)
  static const String _fallbackEnJson = '''
  {
    "discover_arenas": "DISCOVER ARENAS",
    "matchmaking_feed": "MATCHMAKING FEED",
    "wallet_ledger": "WALLET LEDGER",
    "profile_tools": "PROFILE & TOOLS",
    "total_balance": "TOTAL LEDGER BALANCE",
    "deposits": "DEPOSITS",
    "winnings": "WINNINGS",
    "bonus": "BONUS",
    "kyc_status": "KYC Status:",
    "not_verified": "NOT VERIFIED",
    "pending_review": "PENDING REVIEW",
    "verified": "VERIFIED",
    "deposit_funds": "DEPOSIT FUNDS",
    "withdrawal": "WITHDRAWAL",
    "record_score": "RECORD MATCH SCORE",
    "validate_submit": "VALIDATE & SUBMIT",
    "prize_pool": "PRIZE POOL",
    "entry_fee": "Entry fee",
    "accept": "ACCEPT",
    "cancel": "CANCEL",
    "confirm": "CONFIRM",
    "insufficient_balance": "INSUFFICIENT BALANCE",
    "kyc_required": "KYC VERIFICATION REQUIRED",
    "tab_discover": "Discover",
    "tab_challenges": "Challenges",
    "tab_wallet": "Wallet",
    "tab_profile": "Profile"
  }
  ''';

  static const String _fallbackHiJson = '''
  {
    "discover_arenas": "मैदान खोजें",
    "matchmaking_feed": "मैचमेकिंग फीड",
    "wallet_ledger": "बटुआ बहीखाता",
    "profile_tools": "प्रोफाइल और सेटिंग्स",
    "total_balance": "कुल बटुआ राशि",
    "deposits": "जमा राशि",
    "winnings": "जीत की राशि",
    "bonus": "बोनस",
    "kyc_status": "KYC स्थिति:",
    "not_verified": "सत्यापित नहीं",
    "pending_review": "समीक्षा लंबित",
    "verified": "सत्यापित",
    "deposit_funds": "पैसे जमा करें",
    "withdrawal": "निकासी",
    "record_score": "मैच स्कोर दर्ज करें",
    "validate_submit": "जांचें और जमा करें",
    "prize_pool": "इनाम राशि",
    "entry_fee": "प्रवेश शुल्क",
    "accept": "स्वीकार करें",
    "cancel": "रद्द करें",
    "confirm": "पुष्टि करें",
    "insufficient_balance": "अपर्याप्त राशि",
    "kyc_required": "KYC सत्यापन आवश्यक",
    "tab_discover": "खोजें",
    "tab_challenges": "चैलेंज",
    "tab_wallet": "बटुआ",
    "tab_profile": "प्रोफाइल"
  }
  ''';
}
