import 'package:flutter/material.dart';
import 'package:app/core/theme/app_theme.dart';

/// A venue photo, or an honest placeholder.
///
/// Photos are uploaded by the venue owner, so a venue that has not uploaded
/// one has no photo — showing a stock image of somebody else's court in its
/// place misrepresents the venue a player is about to pay for.
class ArenaImage extends StatelessWidget {
  final String? url;
  final double height;
  final BorderRadius? borderRadius;

  const ArenaImage({
    super.key,
    required this.url,
    this.height = 180,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    final radius = borderRadius ?? BorderRadius.circular(16);
    final source = url;

    Widget placeholder() => Container(
          height: height,
          width: double.infinity,
          color: AppColors.bgInset,
          child: Icon(
            Icons.photo_camera_back_outlined,
            size: 40,
            color: AppColors.textMuted,
          ),
        );

    return ClipRRect(
      borderRadius: radius,
      child: source == null || source.isEmpty
          ? placeholder()
          : Image.network(
              source,
              height: height,
              width: double.infinity,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => placeholder(),
            ),
    );
  }
}
