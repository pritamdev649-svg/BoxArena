import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:app/core/constants/api_routes.dart';
import 'package:app/core/services/api_client.dart';
import 'package:app/features/scoring/models/rally_state.dart';

/// Live scoring state for one match.
///
/// Every command round-trips to the server and the response replaces local
/// state. The app deliberately cannot advance a score on its own — if the
/// request fails, the scoreboard stays where the server says it is.
class LiveScoringState {
  final LiveMatch? match;
  final bool loading;
  final bool busy;
  final String? error;
  final String? notice;

  const LiveScoringState({
    this.match,
    this.loading = true,
    this.busy = false,
    this.error,
    this.notice,
  });

  LiveScoringState copyWith({
    LiveMatch? match,
    bool? loading,
    bool? busy,
    String? error,
    String? notice,
    bool clearError = false,
    bool clearNotice = false,
  }) =>
      LiveScoringState(
        match: match ?? this.match,
        loading: loading ?? this.loading,
        busy: busy ?? this.busy,
        error: clearError ? null : (error ?? this.error),
        notice: clearNotice ? null : (notice ?? this.notice),
      );
}

/// One scoreboard at a time.
///
/// Not a family: an official scores a single match on a single device, and a
/// keyed provider would keep stale boards alive in memory for every match they
/// ever opened.
class LiveScoringNotifier extends Notifier<LiveScoringState> {
  ApiClient get _api => ref.read(apiClientProvider);
  String _matchId = '';

  @override
  LiveScoringState build() => const LiveScoringState();

  /// Point the board at a match. Called once when the screen mounts.
  Future<void> open(String matchId) async {
    _matchId = matchId;
    await load();
  }

  /// A tap on 4G at a turf WILL be retried. The key makes the retry a no-op
  /// rather than a phantom point nobody can argue with afterwards.
  String _idempotencyKey() {
    final random = Random();
    final suffix = List.generate(8, (_) => random.nextInt(36).toRadixString(36)).join();
    return '${DateTime.now().microsecondsSinceEpoch}-$suffix';
  }

  Future<void> load() async {
    state = state.copyWith(loading: true, clearError: true);
    try {
      final response = await _api.get(ApiRoutes.matchLive(_matchId));
      state = state.copyWith(
        match: LiveMatch.fromJson(response['data'] as Map<String, dynamic>),
        loading: false,
      );
    } catch (e) {
      state = state.copyWith(loading: false, error: e.toString());
    }
  }

  Future<void> start() async {
    await _command(() => _api.post(ApiRoutes.matchLiveStart(_matchId), const {}));
    if (state.error == null) {
      state = state.copyWith(match: state.match?.copyWith(status: 'in_progress'));
      await load();
    }
  }

  Future<void> recordPoint(String side, {String? outcome}) async {
    await _command(() => _api.post(ApiRoutes.matchLivePoint(_matchId), {
          'side': side,
          'idempotencyKey': _idempotencyKey(),
          'outcome': ?outcome,
        }));
  }

  Future<void> undo() async {
    await _command(() => _api.post(ApiRoutes.matchLiveUndo(_matchId), {
          'idempotencyKey': _idempotencyKey(),
        }));
  }

  Future<void> timeout() async {
    await _command(
      () => _api.post(ApiRoutes.matchLiveEvent(_matchId), {'eventType': 'timeout'}),
      refresh: false,
    );
  }

  /// Returns the outcome message, or null when it failed.
  Future<String?> confirmResult() async {
    state = state.copyWith(busy: true, clearError: true);
    try {
      final response = await _api.post(ApiRoutes.matchLiveConfirm(_matchId), const {});
      final data = response['data'] as Map<String, dynamic>;
      state = state.copyWith(busy: false);
      return data['settled'] == true ? 'settled' : 'awaitingCaptains';
    } catch (e) {
      state = state.copyWith(busy: false, error: e.toString());
      return null;
    }
  }

  Future<void> _command(
    Future<Map<String, dynamic>> Function() run, {
    bool refresh = true,
  }) async {
    state = state.copyWith(busy: true, clearError: true, clearNotice: true);
    try {
      final response = await run();
      final data = response['data'];

      /// The point and undo endpoints answer with the new state, so the
      /// scoreboard updates without a second round trip.
      if (refresh && data is Map<String, dynamic>) {
        final raw = data['state'] ?? data;
        if (raw is Map<String, dynamic> && raw.containsKey('current')) {
          state = state.copyWith(
            match: state.match?.copyWith(state: RallyState.fromJson(raw)),
            busy: false,
            notice: data['changeEnds'] == true ? 'changeEnds' : null,
          );
          return;
        }
      }
      state = state.copyWith(busy: false);
    } catch (e) {
      state = state.copyWith(busy: false, error: e.toString());
    }
  }
}

final liveScoringProvider =
    NotifierProvider<LiveScoringNotifier, LiveScoringState>(LiveScoringNotifier.new);
