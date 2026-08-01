import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';

class AppLoader extends StatelessWidget {
  final double size;
  final Color? color;
  final double strokeWidth;

  const AppLoader({
    super.key,
    this.size = 24.0,
    this.color,
    this.strokeWidth = 3.0,
  });

  // Reusable static instances can also be defined here to save memory allocation
  static const AppLoader small = AppLoader(size: 16.0, strokeWidth: 2.0);
  static const AppLoader medium = AppLoader(size: 24.0, strokeWidth: 3.0);
  static const AppLoader large = AppLoader(size: 40.0, strokeWidth: 4.0);

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: strokeWidth,
        valueColor: AlwaysStoppedAnimation<Color>(color ?? AppColors.volt500),
      ),
    );
  }
}
