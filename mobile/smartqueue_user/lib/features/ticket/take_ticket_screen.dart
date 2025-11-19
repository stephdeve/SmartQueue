import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/app_router.dart';
import 'ticket_provider.dart';

/// Prise de ticket -> redirection vers le suivi
class TakeTicketScreen extends ConsumerWidget {
  final int serviceId;
  final String serviceName;
  const TakeTicketScreen({super.key, required this.serviceId, required this.serviceName});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncTicket = ref.watch(ticketProvider);

    return Scaffold(
      appBar: AppBar(title: Text('Prendre un ticket • $serviceName')),
      body: Center(
        child: asyncTicket.when(
          data: (t) {
            if (t == null) {
              return FilledButton(
                onPressed: () => ref.read(ticketProvider.notifier).take(serviceId),
                child: const Text('Confirmer'),
              );
            }
            return Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Ticket: ${t.ticketNumber}', style: Theme.of(context).textTheme.headlineMedium),
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () => Navigator.pushReplacementNamed(context, AppRouter.realtime, arguments: {
                    'ticketId': t.id,
                    'serviceName': serviceName,
                  }),
                  icon: const Icon(Icons.play_arrow),
                  label: const Text('Suivi en temps réel'),
                ),
              ],
            );
          },
          error: (e, _) => Text('Erreur: $e'),
          loading: () => const CircularProgressIndicator(),
        ),
      ),
    );
  }
}
