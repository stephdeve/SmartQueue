import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/service.dart';
import '../../core/app_router.dart';
import 'services_provider.dart';

/// Liste des services d'un établissement
class ServicesScreen extends ConsumerWidget {
  final int establishmentId;
  final String establishmentName;
  const ServicesScreen({super.key, required this.establishmentId, required this.establishmentName});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncServices = ref.watch(servicesByEstablishmentProvider(establishmentId));

    return Scaffold(
      appBar: AppBar(title: Text('Services • $establishmentName')),
      body: asyncServices.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur: $e')),
        data: (data) => ListView.separated(
          itemCount: data.length,
          separatorBuilder: (_, __) => const Divider(height: 0),
          itemBuilder: (_, i) {
            final s = data[i];
            final color = s.status == 'open' ? Colors.green : Colors.red;
            return ListTile(
              leading: Icon(Icons.confirmation_number, color: color),
              title: Text(s.name),
              subtitle: Text('Temps moyen: ${s.avgServiceTimeMinutes} min'),
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: color.withOpacity(.1),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: color.withOpacity(.3)),
                ),
                child: Text(s.status, style: TextStyle(color: color)),
              ),
              onTap: () => Navigator.pushNamed(context, AppRouter.serviceDetail, arguments: {
                'serviceId': s.id,
                'serviceName': s.name,
              }),
            );
          },
        ),
      ),
    );
  }
}
