import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';

class ThemeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    // Default to Dark Mode ("Floodlit Night")
    AppColors.isDarkMode = true;
    return ThemeMode.dark;
  }

  // Toggle theme mode dynamically
  void toggleTheme() {
    if (state == ThemeMode.dark) {
      state = ThemeMode.light;
      AppColors.isDarkMode = false;
    } else {
      state = ThemeMode.dark;
      AppColors.isDarkMode = true;
    }
  }

  // Explicitly set theme mode
  void setThemeMode(ThemeMode mode) {
    state = mode;
    AppColors.isDarkMode = (mode == ThemeMode.dark);
  }
}

// Global provider for managing selected theme mode
final themeProvider = NotifierProvider<ThemeNotifier, ThemeMode>(ThemeNotifier.new);
