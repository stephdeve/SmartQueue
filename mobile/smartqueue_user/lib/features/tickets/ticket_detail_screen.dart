import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import 'package:smartqueue_user/core/app_router.dart';
import 'package:smartqueue_user/core/app_theme.dart';
import 'package:smartqueue_user/features/realtime/realtime_provider.dart';
import 'package:smartqueue_user/data/api_client.dart';
import 'package:smartqueue_user/data/repositories/tickets_repository.dart';
import 'package:smartqueue_user/data/repositories/services_repository.dart';
import 'package:smartqueue_user/data/repositories/establishments_repository.dart';
import 'package:smartqueue_user/data/models/ticket.dart';

class TicketDetailScreen extends ConsumerWidget {
  final int ticketId;
  final String? serviceName;
  final Ticket? initialTicket;

  const TicketDetailScreen({super.key, required this.ticketId, this.serviceName, this.initialTicket});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (initialTicket != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Détail du ticket')),
        body: _TicketContent(ticket: initialTicket!, serviceName: serviceName),
      );
    }

    final asyncTicket = ref.watch(ticketRealtimeProvider(ticketId));

    return Scaffold(
      appBar: AppBar(title: const Text('Détail du ticket')),
      body: asyncTicket.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => _ErrorView(error: e.toString(), onRetry: () => ref.refresh(ticketRealtimeProvider(ticketId))),
        data: (ticket) => _TicketContent(ticket: ticket, serviceName: serviceName),
      ),
    );
  }
}

class _TicketContent extends StatelessWidget {
  final Ticket ticket;
  final String? serviceName;
  const _TicketContent({required this.ticket, this.serviceName});

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Ticket #${ticket.ticketNumber}', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _StatusChip(status: ticket.status),
                      const SizedBox(width: 8),
                      if (ticket.position != null)
                        Text('Position: ${ticket.position}', style: const TextStyle(color: AppTheme.textSecondary)),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),
          Card(
            child: ListTile(
              leading: const Icon(Icons.store_mall_directory_outlined),
              title: Text(serviceName ?? ticket.serviceName ?? 'Service inconnu'),
              subtitle: Text('Service ID: ${ticket.serviceId}'),
            ),
          ),
          if (ticket.etaMinutes != null) ...[
            const SizedBox(height: 12),
            Card(
              child: ListTile(
                leading: const Icon(Icons.timer_outlined),
                title: const Text('Temps d\'attente estimé'),
                subtitle: Text('${ticket.etaMinutes} min'),
              ),
            ),
          ],
          const SizedBox(height: 24),
          // Actions
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              OutlinedButton.icon(
                onPressed: () async {
                  try {
                    final api = await ApiClient.create();
                    final servicesRepo = ServicesRepository(api);
                    final s = await servicesRepo.detail(ticket.serviceId);
                    final estRepo = EstablishmentsRepository(api);
                    String estName = 'Établissement';
                    try {
                      final est = await estRepo.byId(s.establishmentId);
                      estName = est.name;
                    } catch (_) {}
                    Navigator.pushNamed(
                      context,
                      AppRouter.services,
                      arguments: {
                        'establishmentId': s.establishmentId,
                        'establishmentName': estName,
                      },
                    );
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Impossible d\'ouvrir l\'établissement: ${e.toString().replaceFirst('Exception: ', '')}')),
                    );
                  }
                },
                icon: const Icon(Icons.store_mall_directory_outlined),
                label: const Text('Voir l\'établissement'),
              ),
              OutlinedButton.icon(
                onPressed: () async {
                  await Share.share(
                    'Ticket #${ticket.ticketNumber} — ${serviceName ?? ticket.serviceName ?? 'Service'}',
                    subject: 'Ticket SmartQueue',
                  );
                },
                icon: const Icon(Icons.share_outlined),
                label: const Text('Partager le numéro'),
              ),
              if (ticket.status == 'waiting' || ticket.status == 'called')
                OutlinedButton.icon(
                  onPressed: () async {
                    final confirm = await showDialog<bool>(
                      context: context,
                      builder: (ctx) => AlertDialog(
                        title: const Text('Annuler le ticket ?'),
                        content: const Text('Êtes-vous sûr de vouloir annuler ce ticket ?'),
                        actions: [
                          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Non')),
                          TextButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Oui')),
                        ],
                      ),
                    );
                    if (confirm != true) return;
                    try {
                      final api = await ApiClient.create();
                      final repo = TicketsRepository(api);
                      await repo.cancel(ticket.id);
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Ticket annulé')),
                      );
                      Navigator.pop(context);
                    } catch (e) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
                      );
                    }
                  },
                  style: OutlinedButton.styleFrom(side: const BorderSide(color: AppTheme.errorColor)),
                  icon: const Icon(Icons.cancel_outlined, color: AppTheme.errorColor),
                  label: const Text('Annuler le ticket', style: TextStyle(color: AppTheme.errorColor)),
                ),
            ],
          ),
          const SizedBox(height: 16),
          if (ticket.status == 'waiting' || ticket.status == 'called')
            ElevatedButton.icon(
              onPressed: () => Navigator.pushNamed(
                context,
                AppRouter.realtime,
                arguments: {
                  'ticketId': ticket.id,
                  'serviceName': serviceName ?? ticket.serviceName ?? 'Service',
                  'ticket': ticket,
                },
              ),
              icon: const Icon(Icons.play_circle_outline),
              label: const Text('Suivre en temps réel'),
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
            ),
        ],
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  final String status;
  const _StatusChip({required this.status});

  Color get _color {
    switch (status) {
      case 'waiting':
        return Colors.orange;
      case 'called':
        return Colors.green;
      case 'served':
      case 'closed':
        return Colors.blue;
      case 'cancelled':
      case 'no_show':
        return Colors.red;
      default:
        return AppTheme.primaryColor;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Chip(
      label: Text(status),
      backgroundColor: _color.withOpacity(0.1),
      labelStyle: TextStyle(color: _color),
      side: BorderSide(color: _color.withOpacity(0.4)),
    );
  }
}

class _ErrorView extends StatelessWidget {
  final String error;
  final VoidCallback onRetry;
  const _ErrorView({required this.error, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, size: 48, color: AppTheme.errorColor),
          const SizedBox(height: 16),
          const Text('Erreur de chargement', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Text(error, textAlign: TextAlign.center, style: const TextStyle(color: AppTheme.textSecondary)),
          const SizedBox(height: 24),
          ElevatedButton(onPressed: onRetry, child: const Text('Réessayer')),
        ],
      ),
    );
  }
}
