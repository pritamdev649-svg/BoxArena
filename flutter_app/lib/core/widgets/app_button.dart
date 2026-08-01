import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/widgets/app_loader.dart';

enum AppButtonType { filled, outlined }

class AppButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final AppButtonType type;
  final bool isLoading;
  final IconData? icon;
  final Color? color;
  final Color? textColor;

  const AppButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.type = AppButtonType.filled,
    this.isLoading = false,
    this.icon,
    this.color,
    this.textColor,
  });

  @override
  Widget build(BuildContext context) {
    final themeColor = color ?? AppColors.volt500;
    final displayTextColor = textColor ?? (type == AppButtonType.filled ? AppColors.textInverse : themeColor);

    final style = type == AppButtonType.filled
        ? ElevatedButton.styleFrom(
            backgroundColor: themeColor,
            foregroundColor: displayTextColor,
            elevation: 0,
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          )
        : OutlinedButton.styleFrom(
            foregroundColor: displayTextColor,
            side: BorderSide(color: themeColor),
            padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          );

    final Widget childContent = isLoading
        ? Center(child: AppLoader(size: 20, color: displayTextColor, strokeWidth: 2))
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (icon != null) ...[
                Icon(icon, size: 18),
                const SizedBox(width: 8),
              ],
              Text(
                label,
                style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
              ),
            ],
          );

    if (type == AppButtonType.filled) {
      return ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: style,
        child: childContent,
      );
    } else {
      return OutlinedButton(
        onPressed: isLoading ? null : onPressed,
        style: style,
        child: childContent,
      );
    }
  }
}
