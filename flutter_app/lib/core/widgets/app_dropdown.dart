import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';

class AppDropdown<T> extends StatelessWidget {
  final T value;
  final List<T> items;
  final String label;
  final ValueChanged<T?> onChanged;
  final String Function(T) itemLabelMapper;

  const AppDropdown({
    super.key,
    required this.value,
    required this.items,
    required this.label,
    required this.onChanged,
    required this.itemLabelMapper,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: AppTheme.label),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: AppColors.bgSurface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.borderSubtle),
          ),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: value,
              dropdownColor: AppColors.bgSurface,
              icon: Icon(Icons.keyboard_arrow_down_rounded, color: AppColors.textSecondary),
              style: TextStyle(
                color: AppColors.textPrimary, 
                fontWeight: FontWeight.bold,
                fontSize: 14,
              ),
              items: items.map((T item) {
                return DropdownMenuItem<T>(
                  value: item,
                  child: Text(itemLabelMapper(item)),
                );
              }).toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }
}
