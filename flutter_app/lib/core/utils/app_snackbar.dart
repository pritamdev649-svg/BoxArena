import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';

class AppSnackBar {
  // Shows a customizable SnackBar with predefined behaviors
  static void show(
    BuildContext context, {
    required String message,
    required Color backgroundColor,
    Duration duration = const Duration(seconds: 3),
  }) {
    // Clear any active snackbar immediately to prevent queue delay
    ScaffoldMessenger.of(context).removeCurrentSnackBar();
    
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 13,
            color: Colors.white,
          ),
        ),
        backgroundColor: backgroundColor,
        duration: duration,
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16.0),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8.0),
        ),
      ),
    );
  }

  // Predefined convenience alerts
  static void showSuccess(BuildContext context, String message) {
    show(context, message: message, backgroundColor: AppColors.win);
  }

  static void showError(BuildContext context, String message) {
    show(context, message: message, backgroundColor: AppColors.loss);
  }

  static void showInfo(BuildContext context, String message) {
    show(context, message: message, backgroundColor: AppColors.info);
  }
}
