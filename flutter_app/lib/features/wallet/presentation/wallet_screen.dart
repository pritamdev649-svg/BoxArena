import 'dart:developer';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/features/wallet/providers/wallet_provider.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'package:app/core/providers/locale_provider.dart';
import 'package:app/core/providers/profile_provider.dart';

class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  late Razorpay _razorpay;
  final TextEditingController _amountController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, _handlePaymentSuccess);
    _razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, _handlePaymentError);
    _razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, _handleExternalWallet);

    // Refresh wallet and transaction ledger from backend on startup
    Future.microtask(() {
      ref.read(walletProvider.notifier).refreshWallet();
      ref.read(walletProvider.notifier).fetchTransactions();
    });
  }

  @override
  void dispose() {
    _razorpay.clear();
    _amountController.dispose();
    super.dispose();
  }

  void _handlePaymentSuccess(PaymentSuccessResponse response) async {
    log(
      '[WalletScreen] Razorpay payment success callback: orderId=${response.orderId}',
    );
    try {
      final orderId = response.orderId;
      final paymentId = response.paymentId;
      final signature = response.signature;

      if (orderId == null || paymentId == null || signature == null) {
        throw Exception(
          'Payment completed but verification tokens are missing',
        );
      }

      final credited = await ref
          .read(walletProvider.notifier)
          .verifyTopup(orderId, paymentId, signature);

      if (credited) {
        if (mounted) {
          AppSnackBar.showSuccess(
            context,
            'Successfully credited funds to your wallet!',
          );
        }
      } else {
        if (mounted) {
          AppSnackBar.showError(
            context,
            'Verification completed but wallet wasn\'t credited.',
          );
        }
      }
    } catch (e) {
      if (mounted) {
        AppSnackBar.showError(context, 'Failed to verify payment: $e');
      }
    }
  }

  void _handlePaymentError(PaymentFailureResponse response) {
    log(
      '[WalletScreen] Razorpay payment failure callback: code=${response.code}, message=${response.message}',
    );
    AppSnackBar.showError(context, 'Payment failed: ${response.message}');
  }

  void _handleExternalWallet(ExternalWalletResponse response) {
    log('[WalletScreen] External wallet callback: ${response.walletName}');
  }

  void _showDepositDialog() {
    _amountController.text = '500';
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: AppColors.bgElevated,
          title: Text('ADD FUNDS', style: AppTheme.displayStyle(fontSize: 16)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Enter deposit amount in INR (minimum ₹100)',
                style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _amountController,
                keyboardType: TextInputType.number,
                style: TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
                decoration: InputDecoration(
                  prefixText: '₹ ',
                  hintText: 'Amount',
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 12,
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'CANCEL',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                final amountText = _amountController.text.trim();
                final amount = int.tryParse(amountText) ?? 0;
                if (amount < 100) {
                  AppSnackBar.showError(
                    context,
                    'Minimum deposit amount is ₹100',
                  );
                  return;
                }
                Navigator.pop(context);
                _startDeposit(amount);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.volt500,
              ),
              child: const Text(
                'PROCEED TO PAY',
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  void _startDeposit(int amountInInr) async {
    final amountPaise = amountInInr * 100;
    try {
      final orderData = await ref
          .read(walletProvider.notifier)
          .createTopupOrder(amountPaise);

      final orderId = orderData['orderId'] as String;
      final keyId = orderData['keyId'] as String;

      final profile = ref.read(profileProvider);

      final options = {
        'key': keyId,
        'amount': amountPaise,
        'name': 'BoxArena Payments',
        'order_id': orderId,
        'description': 'Wallet Top-up of ₹$amountInInr',
        'prefill': {
          'contact': profile?.mobileNumber ?? '',
          'name': profile?.name ?? '',
        },
        'external': {
          'wallets': ['paytm'],
        },
      };

      try {
        _razorpay.open(options);
      } catch (e) {
        log(
          '[WalletScreen] Native Razorpay SDK failed to open (falling back to desktop simulator dialog): $e',
        );
        _simulateMockPaymentSuccess(orderId, amountPaise);
      }
    } catch (e) {
      log('[WalletScreen] Failed to create order: $e');
      if (mounted) {
        AppSnackBar.showError(context, 'Failed to create order: $e');
      }
    }
  }

  void _simulateMockPaymentSuccess(String orderId, int amountPaise) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.bgElevated,
        title: Text(
          'DESKTOP SIMULATOR CHECKOUT',
          style: AppTheme.displayStyle(fontSize: 16),
        ),
        content: Text(
          'Native Razorpay SDK is not supported on this platform. Do you want to simulate a successful payment for order ID:\n$orderId?',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(
              'FAIL PAYMENT',
              style: TextStyle(color: AppColors.textSecondary),
            ),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              try {
                final credited = await ref
                    .read(walletProvider.notifier)
                    .verifyTopup(
                      orderId,
                      'pay_mock_${DateTime.now().millisecondsSinceEpoch}',
                      'mock_signature',
                    );

                if (credited) {
                  if (mounted) {
                    AppSnackBar.showSuccess(
                      context,
                      'Mock payment succeeded! Added ₹${(amountPaise / 100).toStringAsFixed(2)} to wallet.',
                    );
                  }
                } else {
                  if (mounted) {
                    AppSnackBar.showError(
                      context,
                      'Mock verification completed but wallet not credited.',
                    );
                  }
                }
              } catch (e) {
                if (mounted) {
                  AppSnackBar.showError(
                    context,
                    'Failed to verify mock payment: $e',
                  );
                }
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppColors.volt500),
            child: const Text(
              'SUCCESS PAYMENT',
              style: TextStyle(
                color: Colors.black,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _requestWithdrawal(WalletState walletState) {
    if (walletState.kycStatus != "verified") {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          backgroundColor: AppColors.bgElevated,
          title: Text(
            'KYC VERIFICATION REQUIRED',
            style: AppTheme.displayStyle(fontSize: 16),
          ),
          content: Text(
            'Under Indian regulations, verified identity documents are required to withdraw game winnings to a bank account.',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text(
                'CANCEL',
                style: TextStyle(color: AppColors.textSecondary),
              ),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.pop(context);
                ref.read(walletProvider.notifier).submitKyc();
                AppSnackBar.show(
                  context,
                  message: 'KYC submitted. Verification takes up to 24 hours.',
                  backgroundColor: AppColors.dispute,
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.volt500,
              ),
              child: const Text(
                'SUBMIT PAN',
                style: TextStyle(
                  color: Colors.black,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      );
      return;
    }

    if (walletState.winningsPaise == 0) {
      AppSnackBar.showError(
        context,
        'No withdrawable winnings balance available.',
      );
      return;
    }

    // final winAmount = walletState.winningsPaise;
    final success = ref.read(walletProvider.notifier).withdrawWinnings();
    if (success) {
      AppSnackBar.showSuccess(
        context,
        'Payout requested. Transferred to verified bank account.',
      );
    }
  }

  String _formatDate(DateTime dt) {
    final now = DateTime.now();
    final diff = now.difference(dt);

    if (diff.inDays == 0 && now.day == dt.day) {
      final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final min = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return 'Today, $hour:$min $ampm';
    } else if (diff.inDays == 1 ||
        (diff.inDays == 0 && now.day - dt.day == 1)) {
      final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final min = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return 'Yesterday, $hour:$min $ampm';
    } else {
      final months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      final month = months[dt.month - 1];
      final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
      final min = dt.minute.toString().padLeft(2, '0');
      final ampm = dt.hour >= 12 ? 'PM' : 'AM';
      return '${dt.day} $month, $hour:$min $ampm';
    }
  }

  @override
  Widget build(BuildContext context) {
    final walletState = ref.watch(walletProvider);
    final l10n = ref.watch(l10nProvider);

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text(
          l10n.walletLedger.toUpperCase(),
          style: AppTheme.displayStyle(fontSize: 18),
        ),
        centerTitle: true,
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Total balance card
          Container(
            padding: const EdgeInsets.all(24.0),
            color: AppColors.bgSurface,
            child: Column(
              children: [
                Text(l10n.totalBalance, style: AppTheme.label),
                const SizedBox(height: 8),
                Text(
                  '₹${(walletState.totalPaise / 100).toStringAsFixed(2)}',
                  style: AppTheme.tabularStyle(
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 20),

                // Segmented breakdown
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    _buildBucketColumn(
                      l10n.deposits,
                      walletState.depositPaise,
                      "For Entry Fees",
                    ),
                    _buildVerticalDivider(),
                    _buildBucketColumn(
                      l10n.winnings,
                      walletState.winningsPaise,
                      "Withdrawable",
                      color: AppColors.win,
                    ),
                    _buildVerticalDivider(),
                    _buildBucketColumn(
                      l10n.bonus,
                      walletState.bonusPaise,
                      "Promo rewards",
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // KYC Status banner
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16.0,
                    vertical: 12.0,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.bgInset,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppColors.borderSubtle),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        l10n.kycStatus,
                        style: TextStyle(
                          color: AppColors.textSecondary,
                          fontSize: 13,
                        ),
                      ),
                      Row(
                        children: [
                          Icon(
                            walletState.kycStatus == "verified"
                                ? Icons.verified_rounded
                                : (walletState.kycStatus == "pending"
                                      ? Icons.pending_rounded
                                      : Icons.warning_amber_rounded),
                            color: walletState.kycStatus == "verified"
                                ? AppColors.win
                                : (walletState.kycStatus == "pending"
                                      ? AppColors.dispute
                                      : AppColors.loss),
                            size: 16,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            walletState.kycStatus == "verified"
                                ? l10n.verified
                                : (walletState.kycStatus == "pending"
                                      ? l10n.pendingReview
                                      : l10n.notVerified),
                            style: TextStyle(
                              color: walletState.kycStatus == "verified"
                                  ? AppColors.win
                                  : (walletState.kycStatus == "pending"
                                        ? AppColors.dispute
                                        : AppColors.loss),
                              fontWeight: FontWeight.bold,
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Action Buttons
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: walletState.isLoading
                        ? null
                        : _showDepositDialog,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.volt500,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    icon: walletState.isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.black,
                              strokeWidth: 2,
                            ),
                          )
                        : const Icon(Icons.add_rounded),
                    label: Text(
                      l10n.depositFunds,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _requestWithdrawal(walletState),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.volt500,
                      side: BorderSide(color: AppColors.volt500),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                    icon: const Icon(Icons.account_balance_rounded),
                    label: Text(
                      l10n.withdrawal,
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Ledger transaction log header
          Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: 16.0,
              vertical: 8.0,
            ),
            child: Text('TRANSACTION LEDGER', style: AppTheme.label),
          ),

          // Ledger list builder
          Expanded(
            child: walletState.transactions.isEmpty
                ? Center(
                    child: Text(
                      'No transactions recorded yet',
                      style: TextStyle(
                        color: AppColors.textSecondary,
                        fontSize: 13,
                      ),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16.0,
                      vertical: 4.0,
                    ),
                    itemCount: walletState.transactions.length,
                    separatorBuilder: (context, index) =>
                        Divider(color: AppColors.borderSubtle),
                    itemBuilder: (context, index) {
                      final tx = walletState.transactions[index];
                      final isCredit = tx.amountPaise > 0;
                      final sign = isCredit ? "+" : "";
                      final amountText =
                          '$sign₹${(tx.amountPaise.abs() / 100).toStringAsFixed(2)}';

                      final amountColor =
                          tx.type == "winning" ||
                              tx.type == "deposit" ||
                              tx.type == "WALLET_CREDITED"
                          ? AppColors.win
                          : (tx.type == "match_escrow" ||
                                    tx.type == "WALLET_DEBITED"
                                ? AppColors.dispute
                                : AppColors.textPrimary);

                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8.0),
                        child: Row(
                          children: [
                            // Status dot
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: amountColor,
                              ),
                            ),
                            const SizedBox(width: 16),

                            // Metadata description
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    tx.description,
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: AppColors.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    _formatDate(tx.createdAt),
                                    style: AppTheme.caption,
                                  ),
                                ],
                              ),
                            ),

                            // Amount
                            Text(
                              amountText,
                              style: AppTheme.tabularStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: amountColor,
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildBucketColumn(
    String title,
    int amountPaise,
    String subtitle, {
    Color? color,
  }) {
    final displayColor = color ?? AppColors.textPrimary;
    return Column(
      children: [
        Text(title, style: AppTheme.label.copyWith(fontSize: 10)),
        const SizedBox(height: 6),
        Text(
          '₹${(amountPaise / 100).toStringAsFixed(0)}',
          style: AppTheme.tabularStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: displayColor,
          ),
        ),
        const SizedBox(height: 4),
        Text(subtitle, style: AppTheme.caption.copyWith(fontSize: 10)),
      ],
    );
  }

  Widget _buildVerticalDivider() {
    return Container(width: 1, height: 45, color: AppColors.borderSubtle);
  }
}
