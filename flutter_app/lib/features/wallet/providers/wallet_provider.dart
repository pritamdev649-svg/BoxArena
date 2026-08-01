import 'dart:developer';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/features/wallet/models/transaction_model.dart';

class WalletState {
  final int depositPaise;
  final int winningsPaise;
  final int bonusPaise;
  final String kycStatus; // "not_submitted" | "pending" | "verified"
  final List<TransactionModel> transactions;
  final bool isLoading;

  WalletState({
    required this.depositPaise,
    required this.winningsPaise,
    required this.bonusPaise,
    required this.kycStatus,
    this.transactions = const [],
    this.isLoading = false,
  });

  int get totalPaise => depositPaise + winningsPaise + bonusPaise;

  WalletState copyWith({
    int? depositPaise,
    int? winningsPaise,
    int? bonusPaise,
    String? kycStatus,
    List<TransactionModel>? transactions,
    bool? isLoading,
  }) {
    return WalletState(
      depositPaise: depositPaise ?? this.depositPaise,
      winningsPaise: winningsPaise ?? this.winningsPaise,
      bonusPaise: bonusPaise ?? this.bonusPaise,
      kycStatus: kycStatus ?? this.kycStatus,
      transactions: transactions ?? this.transactions,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class WalletNotifier extends Notifier<WalletState> {
  @override
  WalletState build() {
    return WalletState(
      depositPaise: 75000,   // ₹750.00
      winningsPaise: 120000, // ₹1,200.00
      bonusPaise: 15000,     // ₹150.00
      kycStatus: "not_submitted",
      transactions: [],
      isLoading: false,
    );
  }

  // Refresh wallet from backend
  Future<void> refreshWallet() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.get(ApiRoutes.wallet);
      final data = response['data'] ?? response;

      final deposit = data['depositPaise'] as int? ?? 0;
      final winnings = data['winningsPaise'] as int? ?? 0;
      final bonus = data['bonusPaise'] as int? ?? 0;

      // Fetch user profile to get true KYC status
      String kyc = 'not_submitted';
      try {
        final userResponse = await client.get('/users/me');
        final userData = userResponse['data'] ?? userResponse;
        kyc = userData['kycStatus'] as String? ?? 'not_submitted';
      } catch (e) {
        log('[WalletNotifier] Failed to load KYC status from backend: $e');
      }

      state = state.copyWith(
        depositPaise: deposit,
        winningsPaise: winnings,
        bonusPaise: bonus,
        kycStatus: kyc,
      );
      log('[WalletNotifier] Wallet refreshed successfully: deposit=$deposit, winnings=$winnings, bonus=$bonus, kycStatus=$kyc');
    } catch (e) {
      log('[WalletNotifier] Failed to refresh wallet: $e');
    }
  }

  // Fetch transaction ledger from backend
  Future<void> fetchTransactions() async {
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.get(ApiRoutes.walletTransactions);
      
      final listData = response['data']?['page'] ?? response['data'] ?? response;
      if (listData is List) {
        final txs = listData.map((e) => TransactionModel.fromJson(e as Map<String, dynamic>)).toList();
        state = state.copyWith(transactions: txs);
        log('[WalletNotifier] Fetched ${txs.length} transactions');
      }
    } catch (e) {
      log('[WalletNotifier] Failed to fetch transactions: $e');
    }
  }

  // Create Razorpay topup order on backend
  Future<Map<String, dynamic>> createTopupOrder(int amountPaise) async {
    state = state.copyWith(isLoading: true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.post(ApiRoutes.topupOrder, {
        'amountPaise': amountPaise,
      });
      final data = response['data'] ?? response;
      state = state.copyWith(isLoading: false);
      return data;
    } catch (e) {
      state = state.copyWith(isLoading: false);
      rethrow;
    }
  }

  // Verify topup payment signature on backend
  Future<bool> verifyTopup(String orderId, String paymentId, String signature) async {
    state = state.copyWith(isLoading: true);
    try {
      final client = ref.read(apiClientProvider);
      final response = await client.post(ApiRoutes.topupVerify, {
        'orderId': orderId,
        'paymentId': paymentId,
        'signature': signature,
      });
      
      final data = response['data'] ?? response;
      final credited = data['credited'] as bool? ?? false;
      
      if (credited) {
        await refreshWallet();
        await fetchTransactions();
      }
      state = state.copyWith(isLoading: false);
      return credited;
    } catch (e) {
      state = state.copyWith(isLoading: false);
      rethrow;
    }
  }

  // Deposit simulated funds
  void depositMockFunds(int amountPaise) {
    state = state.copyWith(depositPaise: state.depositPaise + amountPaise);
  }

  // Debit wallet following Indian RMG rules: bonus -> deposit -> winnings
  bool debitWallet(int amountPaise) {
    if (state.totalPaise < amountPaise) {
      return false; // Insufficient balance
    }

    int remainingToDebit = amountPaise;
    int newBonus = state.bonusPaise;
    int newDeposit = state.depositPaise;
    int newWinnings = state.winningsPaise;

    // 1. Debit Bonus
    if (newBonus >= remainingToDebit) {
      newBonus -= remainingToDebit;
      remainingToDebit = 0;
    } else {
      remainingToDebit -= newBonus;
      newBonus = 0;
    }

    // 2. Debit Deposit
    if (remainingToDebit > 0) {
      if (newDeposit >= remainingToDebit) {
        newDeposit -= remainingToDebit;
        remainingToDebit = 0;
      } else {
        remainingToDebit -= newDeposit;
        newDeposit = 0;
      }
    }

    // 3. Debit Winnings
    if (remainingToDebit > 0) {
      newWinnings -= remainingToDebit;
    }

    state = state.copyWith(
      bonusPaise: newBonus,
      depositPaise: newDeposit,
      winningsPaise: newWinnings,
    );
    return true;
  }

  // Credit winnings (e.g. from match payout)
  void creditWinnings(int amountPaise) {
    state = state.copyWith(winningsPaise: state.winningsPaise + amountPaise);
  }

  // Refund escrow (e.g. from cancelled/tied match)
  void refundEscrow(int amountPaise) {
    state = state.copyWith(depositPaise: state.depositPaise + amountPaise);
  }

  // Submit KYC for verification (auto-approves to 'verified' for local dev test flow)
  void submitKyc() {
    state = state.copyWith(kycStatus: "verified");
  }

  // Withdraw Winnings
  bool withdrawWinnings() {
    if (state.kycStatus != "verified") return false;
    if (state.winningsPaise <= 0) return false;
    
    state = state.copyWith(winningsPaise: 0);
    return true;
  }
}

// Global provider for the wallet notifier
final walletProvider = NotifierProvider<WalletNotifier, WalletState>(WalletNotifier.new);
