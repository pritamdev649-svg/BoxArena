import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/localization/app_localizations.dart';

class LocaleNotifier extends Notifier<String> {
  @override
  String build() {
    return 'en'; // Default language code (English)
  }

  void setLocale(String langCode) {
    state = langCode;
  }
}

// Global provider for managing selected locale state
final localeProvider = NotifierProvider<LocaleNotifier, String>(LocaleNotifier.new);

// Provider that supplies localized dictionary values based on the current locale
final l10nProvider = Provider<AppLocalizations>((ref) {
  final locale = ref.watch(localeProvider);
  return AppLocalizations(locale);
});
