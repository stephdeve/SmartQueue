// features/realtime/realtime_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartqueue_user/core/app_theme.dart';
import 'package:smartqueue_user/features/realtime/realtime_provider.dart';
import 'package:smartqueue_user/data/models/ticket.dart';

class RealtimeScreen extends ConsumerWidget {
  final int ticketId;
  final String serviceName;
  final Ticket? initialTicket;

  const RealtimeScreen({
    super.key,
    required this.ticketId,
    required this.serviceName,
    this.initialTicket,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (initialTicket != null) {
      final ticket = initialTicket!;
      return Scaffold(
        appBar: AppBar(
          title: const Text('Suivi en temps réel'),
        ),
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      Text(
                        'Service: $serviceName',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Ticket #${ticket.ticketNumber}',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              // Status Card
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    children: [
                      const Text(
                        'Statut actuel',
                        style: TextStyle(
                          fontSize: 16,
                          color: AppTheme.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _getStatusText(ticket.status),
                        style: const TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                          color: AppTheme.primaryColor,
                        ),
                      ),
                      if (ticket.position != null) ...[
                        const SizedBox(height: 16),
                        const Text(
                          'Position dans la file',
                          style: TextStyle(
                            fontSize: 16,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${ticket.position}',
                          style: const TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                      if (ticket.etaMinutes != null) ...[
                        const SizedBox(height: 16),
                        const Text(
                          'Temps d\'attente estimé',
                          style: TextStyle(
                            fontSize: 16,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          '${ticket.etaMinutes} min',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              if (ticket.etaMinutes != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        const Text(
                          'Heure estimée de passage',
                          style: TextStyle(
                            fontSize: 16,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _calculateEstimatedTime(ticket.etaMinutes!),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              const SizedBox(height: 32),
              OutlinedButton.icon(
                onPressed: () async {
                  try {
                    // Try fetching live data; on success, reload screen without initialTicket
                    await ref.read(ticketRealtimeProvider(ticketId).future);
                    if (context.mounted) {
                      Navigator.pushReplacementNamed(
                        context,
                        '/ticket/realtime',
                        arguments: {
                          'ticketId': ticketId,
                          'serviceName': serviceName,
                        },
                      );
                    }
                  } catch (e) {
                    if (context.mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text('Impossible d\'obtenir les données en temps réel.')),
                      );
                    }
                  }
                },
                icon: const Icon(Icons.sync),
                label: const Text('Actualiser'),
              ),
            ],
          ),
        ),
      );
    }

    final asyncTicket = ref.watch(ticketRealtimeProvider(ticketId));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Suivi en temps réel'),
      ),
      body: asyncTicket.when(
        data: (ticket) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        Text(
                          'Service: $serviceName',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Ticket #${ticket.ticketNumber}',
                          style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Status Card
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Column(
                      children: [
                        const Text(
                          'Statut actuel',
                          style: TextStyle(
                            fontSize: 16,
                            color: AppTheme.textSecondary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _getStatusText(ticket.status),
                          style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.bold,
                            color: AppTheme.primaryColor,
                          ),
                        ),
                        if (ticket.position != null) ...[
                          const SizedBox(height: 16),
                          const Text(
                            'Position dans la file',
                            style: TextStyle(
                              fontSize: 16,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${ticket.position}',
                            style: const TextStyle(
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                        if (ticket.etaMinutes != null) ...[
                          const SizedBox(height: 16),
                          const Text(
                            'Temps d\'attente estimé',
                            style: TextStyle(
                              fontSize: 16,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            '${ticket.etaMinutes} min',
                            style: const TextStyle(
                              fontSize: 24,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                // Estimated Time Card
                if (ticket.etaMinutes != null)
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Column(
                        children: [
                          const Text(
                            'Heure estimée de passage',
                            style: TextStyle(
                              fontSize: 16,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _calculateEstimatedTime(ticket.etaMinutes!),
                            style: const TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                const SizedBox(height: 32),
                // Call to Action
                if (ticket.status == 'called')
                  ElevatedButton(
                    onPressed: () {
                      // TODO: Handle notification
                    },
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      backgroundColor: Colors.green,
                    ),
                    child: const Text(
                      'J\'arrive !',
                      style: TextStyle(fontSize: 16),
                    ),
                  )
                else
                  OutlinedButton(
                    onPressed: () {
                      // TODO: Handle cancel
                    },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      side: const BorderSide(color: AppTheme.errorColor),
                    ),
                    child: const Text(
                      'Annuler le ticket',
                      style: TextStyle(
                        color: AppTheme.errorColor,
                        fontSize: 16,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                size: 48,
                color: AppTheme.errorColor,
              ),
              const SizedBox(height: 16),
              const Text(
                'Erreur de chargement',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32.0),
                child: Text(
                  error.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: AppTheme.textSecondary),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.refresh(ticketRealtimeProvider(ticketId)),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'waiting':
        return 'En attente';
      case 'called':
        return 'C\'est votre tour !';
      case 'served':
        return 'Service effectué';
      case 'cancelled':
        return 'Annulé';
      default:
        return status;
    }
  }

  String _calculateEstimatedTime(int etaMinutes) {
    final now = DateTime.now();
    final estimatedTime = now.add(Duration(minutes: etaMinutes));
    return '${_twoDigits(estimatedTime.hour)}:${_twoDigits(estimatedTime.minute)}';
  }

  String _twoDigits(int n) => n.toString().padLeft(2, '0');
}