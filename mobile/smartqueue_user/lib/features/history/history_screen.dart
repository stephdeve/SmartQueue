import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/ticket.dart';
import 'history_provider.dart';

/// Historique des tickets de l'utilisateur (/tickets/history)
class HistoryScreen extends ConsumerWidget {
  const HistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncHistory = ref.watch(historyTicketsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Historique')),
      body: asyncHistory.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur: $e')),
        data: (data) {
          final tickets = data.cast<Ticket>();
          if (tickets.isEmpty) return const Center(child: Text('Aucun ticket dans l’historique'));
          return ListView.separated(
            itemCount: tickets.length,
            separatorBuilder: (_, __) => const Divider(height: 0),
            itemBuilder: (_, i) {
              final t = tickets[i];
              final color = t.status == 'closed' ? Colors.green : Colors.red;
              return ListTile(
                leading: CircleAvatar(backgroundColor: color.withOpacity(.15), child: Icon(Icons.history, color: color)),
                title: Text('Ticket ${t.ticketNumber}'),
                subtitle: Text('Statut: ${t.status} • Service #${t.serviceId}'),
              );
            },
          );
        },
      ),
    );
  }
}
