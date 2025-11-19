import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/app_router.dart';
import '../../data/models/service.dart';
import 'service_detail_provider.dart';

/// Détails d’un service + CTA "Prendre un ticket"
class ServiceDetailScreen extends ConsumerWidget {
  final int serviceId;
  final String serviceName;
  const ServiceDetailScreen({super.key, required this.serviceId, required this.serviceName});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncDetail = ref.watch(serviceDetailProvider(serviceId));
    return Scaffold(
      appBar: AppBar(title: Text(serviceName)),
      body: asyncDetail.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur: $e')),
        data: (data) {
          final s = data;
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                Card(
                  child: ListTile(
                    title: Text(s.name, style: Theme.of(context).textTheme.titleLarge),
                    subtitle: Text('Temps moyen: ${s.avgServiceTimeMinutes} min'),
                    trailing: Chip(
                      label: Text(s.status),
                      backgroundColor: s.status == 'open' ? Colors.green.withOpacity(.15) : Colors.red.withOpacity(.15),
                      labelStyle: TextStyle(color: s.status == 'open' ? Colors.green : Colors.red),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: s.status == 'open'
                      ? () => Navigator.pushNamed(context, AppRouter.takeTicket, arguments: {
                            'serviceId': s.id,
                            'serviceName': s.name,
                          })
                      : null,
                  icon: const Icon(Icons.confirmation_number),
                  label: const Text('Prendre un ticket'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
