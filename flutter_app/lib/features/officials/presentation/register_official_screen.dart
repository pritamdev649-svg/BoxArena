import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/widgets/app_input_field.dart';

/// Registering as an official (featuredoc/11 §OF1).
///
/// Anyone may list themselves and set their own price. What registration does
/// NOT grant is the power to settle a money match — that needs ID verification
/// by ops. The form says so, rather than letting someone find out at a match.
class RegisterOfficialScreen extends ConsumerStatefulWidget {
  const RegisterOfficialScreen({super.key});

  @override
  ConsumerState<RegisterOfficialScreen> createState() => _RegisterOfficialScreenState();
}

class _RegisterOfficialScreenState extends ConsumerState<RegisterOfficialScreen> {
  final _name = TextEditingController();
  final _price = TextEditingController();
  final _experience = TextEditingController();
  final _sports = <String>{'badminton'};

  bool _pending = false;
  String? _error;
  bool _done = false;

  @override
  void dispose() {
    _name.dispose();
    _price.dispose();
    _experience.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _pending = true;
      _error = null;
    });

    try {
      await ref.read(apiClientProvider).post(ApiRoutes.officials, {
        'type': 'independent',
        'displayName': _name.text.trim(),
        'sports': _sports.toList(),
        // Rupees on screen, integer paise on the wire.
        'pricePerMatchPaise': ((double.tryParse(_price.text) ?? 0) * 100).round(),
        if (_experience.text.isNotEmpty) 'experienceYears': int.tryParse(_experience.text),
      });
      if (mounted) setState(() => _done = true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Officiate matches')),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: _done ? _doneView() : _form(),
        ),
      ),
    );
  }

  Widget _doneView() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.win.withValues(alpha: 0.12),
        border: Border.all(color: AppColors.win.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('You are listed.',
              style: TextStyle(color: AppColors.win, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text(
            'Captains can now find and book you. Submit ID verification to settle prize money '
            'without both captains confirming.',
            style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _form() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          'Set your own price per match. Verified officials can settle prize money on their '
          'scorecard alone.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 20),
        _Labelled(
          label: 'Name players will see',
          child: AppInputField(controller: _name, hintText: 'R. Sharma'),
        ),
        const SizedBox(height: 16),
        Text('SPORTS YOU OFFICIATE',
            style: TextStyle(fontSize: 11, letterSpacing: 1, color: AppColors.textMuted)),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          children: ['badminton', 'cricket', 'football'].map((sport) {
            final isOn = _sports.contains(sport);
            return GestureDetector(
              onTap: () => setState(() {
                if (isOn) {
                  _sports.remove(sport);
                } else {
                  _sports.add(sport);
                }
              }),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: isOn ? AppColors.volt500 : Colors.transparent,
                  border: Border.all(color: isOn ? AppColors.volt500 : AppColors.borderDefault),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(sport,
                    style: TextStyle(
                      color: isOn ? AppColors.textInverse : AppColors.textSecondary,
                      fontWeight: isOn ? FontWeight.w600 : FontWeight.w400,
                    )),
              ),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
        _Labelled(
          label: 'Your fee per match (₹)',
          child: AppInputField(
            controller: _price,
            hintText: '400',
            keyboardType: TextInputType.number,
          ),
        ),
        const SizedBox(height: 16),
        _Labelled(
          label: 'Years of experience',
          child: AppInputField(
            controller: _experience,
            hintText: '5',
            keyboardType: TextInputType.number,
          ),
        ),
        if (_error != null) ...[
          const SizedBox(height: 16),
          Text(_error!, style: TextStyle(color: AppColors.loss, fontSize: 13)),
        ],
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: AppColors.borderSubtle)),
          child: Text(
            'You can officiate and be paid straight away. Until ops verify your ID, a result you '
            'record still needs both captains to agree before prize money moves.',
            style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
        ),
        const SizedBox(height: 20),
        AppButton(
          label: _pending ? 'Registering…' : 'Register as an official',
          onPressed: (_pending || _sports.isEmpty) ? null : _submit,
        ),
      ],
    );
  }
}


/// `AppInputField` is hint-only, so labels live here rather than being bolted
/// onto the shared widget for one screen.
class _Labelled extends StatelessWidget {
  final String label;
  final Widget child;

  const _Labelled({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label.toUpperCase(),
          style: TextStyle(fontSize: 11, letterSpacing: 1, color: AppColors.textMuted),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}
