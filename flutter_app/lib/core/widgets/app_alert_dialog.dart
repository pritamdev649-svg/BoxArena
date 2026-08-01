import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';

enum AppAlertStatus { normal, success, error }

class AppAlertDialog extends StatelessWidget {
  final String title;
  final String content;
  final String confirmLabel;
  final VoidCallback onConfirm;
  final String? cancelLabel;
  final VoidCallback? onCancel;
  final AppAlertStatus status;

  const AppAlertDialog({
    super.key,
    required this.title,
    required this.content,
    required this.confirmLabel,
    required this.onConfirm,
    this.cancelLabel,
    this.onCancel,
    this.status = AppAlertStatus.normal,
  });

  @override
  Widget build(BuildContext context) {
    Color titleColor = AppColors.textPrimary;
    if (status == AppAlertStatus.success) {
      titleColor = AppColors.win;
    } else if (status == AppAlertStatus.error) {
      titleColor = AppColors.loss;
    }

    return AlertDialog(
      backgroundColor: AppColors.bgElevated,
      title: Text(title.toUpperCase(), style: AppTheme.displayStyle(fontSize: 16, color: titleColor)),
      content: Text(
        content,
        style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
      ),
      actions: [
        if (cancelLabel != null)
          TextButton(
            onPressed: onCancel ?? () => Navigator.pop(context),
            child: Text(cancelLabel!, style: TextStyle(color: AppColors.textSecondary)),
          ),
        ElevatedButton(
          onPressed: onConfirm,
          style: ElevatedButton.styleFrom(
            backgroundColor: status == AppAlertStatus.error ? AppColors.loss : AppColors.volt500,
            foregroundColor: Colors.black,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
          ),
          child: Text(confirmLabel, style: const TextStyle(fontWeight: FontWeight.bold)),
        ),
      ],
    );
  }
}
