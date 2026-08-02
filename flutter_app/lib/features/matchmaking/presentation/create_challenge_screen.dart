import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:app/core/theme/app_theme.dart';
import 'package:app/core/providers/profile_provider.dart';
import 'package:app/core/utils/app_snackbar.dart';
import 'package:app/core/widgets/app_button.dart';
import 'package:app/core/widgets/app_input_field.dart';
import 'package:app/features/booking/providers/my_bookings_provider.dart';
import 'package:app/features/matchmaking/providers/challenges_provider.dart';
import 'package:app/features/matchmaking/providers/my_teams_provider.dart';

/// Posting a challenge.
///
/// A challenge is an invitation to play on a court **you have already booked
/// and paid for**, so this screen starts from your bookings rather than from a
/// venue dropdown. The previous version let you type a venue name and a time,
/// and the server quietly manufactured a ₹0 booking to match — which meant a
/// challenge could point at a court nobody had reserved.
///
/// Badminton only for now: it is the only sport with an official-run
/// scoreboard, and a stake needs a verified result.
class CreateChallengeScreen extends ConsumerStatefulWidget {
  const CreateChallengeScreen({super.key});

  @override
  ConsumerState<CreateChallengeScreen> createState() =>
      _CreateChallengeScreenState();
}

class _CreateChallengeScreenState extends ConsumerState<CreateChallengeScreen> {
  final _entryFeeController = TextEditingController(text: '300');
  final _teamNameController = TextEditingController();

  String? _bookingPublicId;
  String? _teamPublicId;
  bool _creatingNewTeam = false;
  bool _submitting = false;

  @override
  void dispose() {
    _entryFeeController.dispose();
    _teamNameController.dispose();
    super.dispose();
  }

  Future<void> _publish() async {
    final bookingId = _bookingPublicId;
    if (bookingId == null) {
      AppSnackBar.showError(context, 'Pick the booking this challenge is for.');
      return;
    }

    final fee = int.tryParse(_entryFeeController.text.trim());
    if (fee == null || fee < 0) {
      AppSnackBar.showError(context, 'Enter a valid entry fee.');
      return;
    }

    setState(() => _submitting = true);

    try {
      var teamId = _teamPublicId;

      /// Created inline, so a first-time player is not sent to another screen
      /// and back just to have a team to post with.
      if (teamId == null) {
        final name = _teamNameController.text.trim();
        if (name.isEmpty) {
          AppSnackBar.showError(context, 'Give your team a name.');
          return;
        }
        final team = await createTeam(
          ref,
          name: name,
          sport: 'badminton',
          format: 'singles',
        );
        teamId = team.publicId;
      }

      final created =
          await ref.read(challengesProvider.notifier).createChallenge(
                bookingPublicId: bookingId,
                teamPublicId: teamId,
                entryFeePaise: fee * 100,
              );

      if (!mounted) return;

      if (created) {
        AppSnackBar.showSuccess(context, 'Challenge posted.');
        Navigator.of(context).pop();
      } else {
        AppSnackBar.showError(context, 'Could not post that challenge.');
      }
    } catch (error) {
      if (mounted) AppSnackBar.showError(context, error.toString());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bookings = ref.watch(myBookingsProvider);

    return Scaffold(
      backgroundColor: AppColors.bgBase,
      appBar: AppBar(
        title: Text('POST A CHALLENGE', style: AppTheme.displayStyle(fontSize: 16)),
        centerTitle: true,
      ),
      body: bookings.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => _Message(
          title: 'Could not load your bookings',
          body: error.toString(),
        ),
        data: _buildForm,
      ),
    );
  }

  Widget _buildForm(List<MyBooking> all) {
    final hostable = all.where((booking) => booking.canHostChallenge).toList();
    if (hostable.isEmpty) return const _NoBookings();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('YOUR BOOKING', style: AppTheme.label),
        const SizedBox(height: 8),
        ...hostable.map(_bookingTile),
        const SizedBox(height: 24),
        Text('YOUR TEAM', style: AppTheme.label),
        const SizedBox(height: 8),
        _TeamPicker(
          selected: _teamPublicId,
          creatingNew: _creatingNewTeam,
          nameController: _teamNameController,
          onSelect: (id) => setState(() {
            _teamPublicId = id;
            _creatingNewTeam = false;
          }),
          onCreateNew: () => setState(() {
            _teamPublicId = null;
            _creatingNewTeam = true;
          }),
        ),
        const SizedBox(height: 24),
        Text('ENTRY FEE PER TEAM', style: AppTheme.label),
        const SizedBox(height: 8),
        AppInputField(
          controller: _entryFeeController,
          hintText: 'Entry fee',
          prefixText: '₹ ',
          keyboardType: TextInputType.number,
        ),
        const SizedBox(height: 8),
        Text(
          'Both teams pay this. The winner takes the pool less the platform '
          'commission. You have already paid for the court, and the official '
          'charges their own fee on top.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 12),
        ),
        const SizedBox(height: 28),
        AppButton(
          label: 'POST CHALLENGE',
          isLoading: _submitting,
          onPressed: _submitting ? null : _publish,
        ),
        const SizedBox(height: 32),
      ],
    );
  }

  Widget _bookingTile(MyBooking booking) {
    final selected = _bookingPublicId == booking.publicId;

    return GestureDetector(
      onTap: () => setState(() => _bookingPublicId = booking.publicId),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.bgSurface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: selected ? AppColors.volt500 : AppColors.borderSubtle,
            width: selected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    booking.arenaName,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${booking.courtName} · '
                    '${DateFormat('EEE d MMM, h:mm a').format(booking.startAt)}',
                    style: TextStyle(
                      color: AppColors.textSecondary,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            if (selected)
              Icon(Icons.check_circle_rounded, color: AppColors.volt500),
          ],
        ),
      ),
    );
  }
}

/// The honest dead end: no booking, no challenge.
class _NoBookings extends StatelessWidget {
  const _NoBookings();

  @override
  Widget build(BuildContext context) {
    return const _Message(
      title: 'Book a court first',
      body: 'A challenge is an invitation to play on a court you have already '
          'booked. Reserve a badminton court, then come back and post it.',
    );
  }
}

class _Message extends StatelessWidget {
  final String title;
  final String body;

  const _Message({required this.title, required this.body});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 10),
            Text(
              body,
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
            ),
          ],
        ),
      ),
    );
  }
}

class _TeamPicker extends ConsumerWidget {
  final String? selected;
  final bool creatingNew;
  final TextEditingController nameController;
  final ValueChanged<String> onSelect;
  final VoidCallback onCreateNew;

  const _TeamPicker({
    required this.selected,
    required this.creatingNew,
    required this.nameController,
    required this.onSelect,
    required this.onCreateNew,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final teams = ref.watch(myTeamsProvider);
    final profile = ref.watch(profileProvider);

    return teams.when(
      loading: () => const LinearProgressIndicator(),
      error: (error, _) => Text(
        error.toString(),
        style: TextStyle(color: AppColors.loss, fontSize: 12),
      ),
      data: (all) {
        final badminton =
            all.where((team) => team.sport == 'badminton').toList();

        /// No team yet — jump straight to naming one rather than showing an
        /// empty picker the player cannot act on.
        if (badminton.isEmpty && !creatingNew) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (nameController.text.isEmpty && profile != null) {
              nameController.text = "${profile.name}'s Team";
            }
            onCreateNew();
          });
        }

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ...badminton.map(
              (team) => ListTile(
                contentPadding: EdgeInsets.zero,
                onTap: () => onSelect(team.publicId),
                leading: Icon(
                  !creatingNew && selected == team.publicId
                      ? Icons.radio_button_checked
                      : Icons.radio_button_unchecked,
                  color: !creatingNew && selected == team.publicId
                      ? AppColors.volt500
                      : AppColors.textSecondary,
                ),
                title: Text(team.name),
                subtitle: Text(
                  team.format,
                  style: TextStyle(color: AppColors.textSecondary),
                ),
              ),
            ),
            if (creatingNew)
              AppInputField(
                controller: nameController,
                hintText: 'New team name',
              )
            else
              TextButton.icon(
                onPressed: onCreateNew,
                icon: const Icon(Icons.add, size: 18),
                label: const Text('Create a new team'),
              ),
          ],
        );
      },
    );
  }
}
