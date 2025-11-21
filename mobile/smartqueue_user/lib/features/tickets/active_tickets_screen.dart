import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/ticket.dart';
import 'active_tickets_provider.dart';
import 'package:smartqueue_user/core/app_router.dart';

/// Tickets actifs de l'utilisateur (waiting/called/absent)
class ActiveTicketsScreen extends ConsumerWidget {
  const ActiveTicketsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncTickets = ref.watch(activeTicketsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Mes tickets'),
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'Historique',
            onPressed: () => Navigator.pushNamed(context, AppRouter.history),
          ),
        ],
      ),
      body: asyncTickets.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur: $e')),
        data: (data) {
          final tickets = data.cast<Ticket>();
          if (tickets.isEmpty) {
            return const Center(child: Text('Aucun ticket actif'));
          }
          return ListView.separated(
            itemCount: tickets.length,
            separatorBuilder: (_, __) => const Divider(height: 0),
            itemBuilder: (_, i) {
              final t = tickets[i];
              final color = t.status == 'called' ? Colors.blue : (t.status == 'waiting' ? Colors.orange : Colors.red);
              return ListTile(
                leading: CircleAvatar(backgroundColor: color.withOpacity(.15), child: Icon(Icons.confirmation_number, color: color)),
                title: Text('Ticket ${t.ticketNumber}'),
                subtitle: Text('Statut: ${t.status}${t.position != null ? ' • Position: ${t.position}' : ''}${t.etaMinutes != null ? ' • ETA: ${t.etaMinutes} min' : ''}'),
                trailing: Icon(Icons.chevron_right, color: Colors.grey[600]),
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    AppRouter.ticketDetail,
                    arguments: {
                      'ticketId': t.id,
                      'serviceName': t.serviceName,
                      'ticket': t,
                    },
                  );
                },
              );
            },
          );
        },
      ),
    );
  }
}
