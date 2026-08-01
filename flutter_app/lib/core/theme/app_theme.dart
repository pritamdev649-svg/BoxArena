import 'package:flutter/material.dart';

class AppColors {
  // Global flag to toggle between Dark ("Floodlit Night") and Light ("White Court")
  static bool isDarkMode = true;

  // Base background colors
  static Color get bgBase => isDarkMode ? const Color(0xFF0A0E13) : const Color(0xFFF3F5F7);
  static Color get bgSurface => isDarkMode ? const Color(0xFF121821) : Colors.white;
  static Color get bgElevated => isDarkMode ? const Color(0xFF1B232E) : Colors.white;
  static Color get bgInset => isDarkMode ? const Color(0xFF070A0E) : const Color(0xFFECEFF2);

  // Borders
  static Color get borderSubtle => isDarkMode ? const Color(0xFF1E2733) : const Color(0xFFE5E7EB);
  static Color get borderDefault => isDarkMode ? const Color(0xFF2A3644) : const Color(0xFFD1D5DB);
  static Color get borderStrong => isDarkMode ? const Color(0xFF3B4A5C) : const Color(0xFF9CA3AF);

  // Text colors
  static Color get textPrimary => isDarkMode ? const Color(0xFFF2F5F8) : const Color(0xFF111827);
  static Color get textSecondary => isDarkMode ? const Color(0xFF9AA8B8) : const Color(0xFF4B5563);
  static Color get textMuted => isDarkMode ? const Color(0xFF64748B) : const Color(0xFF9CA3AF);
  static Color get textInverse => isDarkMode ? const Color(0xFF0A0E13) : Colors.white;

  // Primary Accent (Neon Volt in Dark, Deep Green in Light matching reference image)
  static Color get volt400 => isDarkMode ? const Color(0xFFD4FF57) : const Color(0xFF0F9F5A);
  static Color get volt500 => isDarkMode ? const Color(0xFFC2F53C) : const Color(0xFF10B981);
  static Color get volt600 => isDarkMode ? const Color(0xFFA5D62B) : const Color(0xFF059669);
  static Color get voltGlow => isDarkMode ? const Color(0x2E2FF53C) : const Color(0x1A10B981);

  // Semantic (constant across themes)
  static const Color win = Color(0xFF34D77F);
  static const Color loss = Color(0xFFF0556B);
  static const Color dispute = Color(0xFFFFA524);
  static const Color info = Color(0xFF4DA6FF);
  static const Color gold = Color(0xFFFFC245);

  // Sports supported colors
  static const Color sportCricket = Color(0xFFFF8A3D);
  static const Color sportFootball = Color(0xFF4DA6FF);
  static const Color sportBadminton = Color(0xFFC2F53C);
}

class AppTheme {
  // Returns Dark Theme settings
  static ThemeData get darkTheme {
    return ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: AppColors.bgBase,
      primaryColor: AppColors.volt500,
      colorScheme: ColorScheme.dark(
        primary: AppColors.volt500,
        secondary: AppColors.info,
        surface: AppColors.bgSurface,
      ),
      cardTheme: CardThemeData(
        color: AppColors.bgSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(12)),
          side: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.bgBase,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.textPrimary),
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.bgElevated,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.borderDefault, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 20),
          shape: const StadiumBorder(),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 20),
          shape: const StadiumBorder(),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        filled: true,
        fillColor: AppColors.bgInset,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.volt500, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.loss, width: 1),
        ),
        labelStyle: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 14),
      ),
    );
  }

  // Returns Light Theme settings (White Theme matching screenshots)
  static ThemeData get lightTheme {
    return ThemeData(
      brightness: Brightness.light,
      scaffoldBackgroundColor: AppColors.bgBase,
      primaryColor: AppColors.volt500,
      colorScheme: ColorScheme.light(
        primary: AppColors.volt500,
        secondary: AppColors.info,
        surface: AppColors.bgSurface,
      ),
      cardTheme: CardThemeData(
        color: AppColors.bgSurface,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(12)),
          side: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: AppColors.bgBase,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.textPrimary),
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w500,
          letterSpacing: 0.5,
        ),
      ),
      dialogTheme: DialogThemeData(
        backgroundColor: AppColors.bgElevated,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: const BorderRadius.all(Radius.circular(16)),
          side: BorderSide(color: AppColors.borderDefault, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 20),
          shape: const StadiumBorder(),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 20),
          shape: const StadiumBorder(),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        filled: true,
        fillColor: AppColors.bgInset,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.borderSubtle, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: AppColors.volt500, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: const BorderSide(color: AppColors.loss, width: 1),
        ),
        labelStyle: TextStyle(color: AppColors.textSecondary, fontSize: 14),
        hintStyle: TextStyle(color: AppColors.textMuted, fontSize: 14),
      ),
    );
  }

  // Display Typography (condensed thin-medium, uppercase tracking -0.01em)
  static TextStyle displayStyle({
    double fontSize = 24,
    Color? color,
  }) {
    return TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w500,
      color: color ?? AppColors.textPrimary,
      letterSpacing: -0.3,
    );
  }

  // Tabular Numerals TextStyle for scores and money
  static TextStyle tabularStyle({
    double fontSize = 16,
    FontWeight fontWeight = FontWeight.normal,
    Color? color,
  }) {
    return TextStyle(
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color ?? AppColors.textPrimary,
      fontFeatures: const [
        FontFeature.tabularFigures(),
      ],
    );
  }

  // Dynamic getters for body and label text styles
  static TextStyle get body => TextStyle(
        fontSize: 16,
        color: AppColors.textPrimary,
        height: 1.5,
      );

  static TextStyle get bodySecondary => TextStyle(
        fontSize: 14,
        color: AppColors.textSecondary,
        height: 1.45,
      );

  static TextStyle get caption => TextStyle(
        fontSize: 12,
        color: AppColors.textMuted,
        height: 1.4,
      );

  static TextStyle get label => TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.bold,
        color: AppColors.textMuted,
        letterSpacing: 0.8,
      );
}
