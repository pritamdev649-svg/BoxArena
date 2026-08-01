import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:go_router/go_router.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/widgets/app_input_field.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'package:app/features/auth/providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _otpController = TextEditingController();

  bool _otpSent = false;

  void _sendOtp() async {
    final phone = _phoneController.text.trim();
    if (phone.length < 10) {
      AppSnackBar.showError(
        context,
        'Please enter a valid 10-digit mobile number',
      );
      return;
    }

    final success = await ref.read(authControllerProvider.notifier).sendOtp(phone);
    if (success) {
      setState(() => _otpSent = true);
      AppSnackBar.showSuccess(
        context,
        'OTP sent successfully! Use code 123456',
      );
    } else {
      final error = ref.read(authControllerProvider).errorMessage ?? 'Failed to send OTP';
      AppSnackBar.showError(context, error);
    }
  }

  void _verifyOtp() async {
    final otp = _otpController.text.trim();
    if (otp.length < 6) {
      AppSnackBar.showError(context, 'Please enter a valid 6-digit OTP');
      return;
    }

    final phone = _phoneController.text.trim();
    final isDirectLogin = await ref.read(authControllerProvider.notifier).verifyOtp(phone, otp);
    
    final error = ref.read(authControllerProvider).errorMessage;
    if (error != null) {
      AppSnackBar.showError(context, error);
      return;
    }

    if (isDirectLogin) {
      AppSnackBar.showSuccess(
        context,
        'Welcome back!',
      );
    } else {
      context.go('/register', extra: {'phone': phone});
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(
          'MOBILE AUTHENTICATION',
          style: AppTheme.displayStyle(fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.sports_soccer_rounded,
              size: 64,
              color: AppColors.volt500,
            ),
            const SizedBox(height: 24),
            Text(
              _otpSent ? 'ENTER VERIFICATION CODE' : 'ENTER MOBILE NUMBER',
              style: AppTheme.displayStyle(fontSize: 20),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _otpSent
                  ? 'We have sent a 6-digit OTP code to +91 ${_phoneController.text}'
                  : 'Verify your phone number to access matches, leaderboards, and wallets',
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),

            if (!_otpSent) ...[
              AppInputField(
                controller: _phoneController,
                hintText: 'Mobile number',
                keyboardType: TextInputType.phone,
                maxLength: 10,
                prefixText: '+91 ',
                prefixIcon: Icons.phone_iphone_rounded,
              ),
              const SizedBox(height: 20),
              AppButton(
                label: 'SEND OTP',
                onPressed: _sendOtp,
                isLoading: authState.isLoading,
              ),
            ] else ...[
              AppInputField(
                controller: _otpController,
                hintText: 'Enter 6-digit OTP',
                keyboardType: TextInputType.number,
                maxLength: 6,
                prefixIcon: Icons.lock_outline_rounded,
              ),
              const SizedBox(height: 20),
              AppButton(
                label: 'VERIFY & CONTINUE',
                onPressed: _verifyOtp,
                isLoading: authState.isLoading,
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: authState.isLoading
                    ? null
                    : () {
                        setState(() {
                          _otpSent = false;
                          _otpController.clear();
                        });
                      },
                child: Text(
                  'Change Phone Number',
                  style: TextStyle(color: AppColors.volt500, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
