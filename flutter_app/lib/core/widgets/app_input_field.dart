import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';

class AppInputField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final IconData? prefixIcon;
  final String? prefixText;
  final TextInputType keyboardType;
  final int? maxLength;
  final bool obscureText;
  final ValueChanged<String>? onChanged;

  const AppInputField({
    super.key,
    required this.controller,
    required this.hintText,
    this.prefixIcon,
    this.prefixText,
    this.keyboardType = TextInputType.text,
    this.maxLength,
    this.obscureText = false,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextField(
      controller: controller,
      keyboardType: keyboardType,
      maxLength: maxLength,
      obscureText: obscureText,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hintText,
        counterText: '',
        prefixText: prefixText,
        prefixStyle: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold),
        prefixIcon: prefixIcon != null ? Icon(prefixIcon, color: AppColors.info) : null,
      ),
      style: TextStyle(color: AppColors.textPrimary),
    );
  }
}
