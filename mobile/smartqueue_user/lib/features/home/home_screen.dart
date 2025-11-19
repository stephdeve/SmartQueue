import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/models/establishment.dart';
import '../../core/app_router.dart';
import 'home_provider.dart';

/// Accueil: établissements proches + badge d'affluence
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncEsts = ref.watch(nearbyEstablishmentsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Établissements proches')),
      body: asyncEsts.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur: $e')),
        data: (data) {
          final ests = data.cast<Establishment>();
          if (ests.isEmpty) return const Center(child: Text('Aucun établissement proche'));
          return ListView.separated(
            itemCount: ests.length,
            separatorBuilder: (_, __) => const Divider(height: 0),
            itemBuilder: (_, i) {
              final e = ests[i];
              final color = e.affluence == 'low'
                  ? Colors.green
                  : e.affluence == 'high'
                      ? Colors.red
                      : Colors.orange;
              return ListTile(
                leading: CircleAvatar(backgroundColor: color.withOpacity(.15), child: Icon(Icons.store, color: color)),
                title: Text(e.name),
                subtitle: Text(e.address ?? ''),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: color.withOpacity(.1),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(color: color.withOpacity(.3)),
                  ),
                  child: Text('Affluence: ${e.affluence}', style: TextStyle(color: color)),
                ),
                onTap: () => Navigator.pushNamed(context, AppRouter.services, arguments: {
                  'establishmentId': e.id,
                  'establishmentName': e.name,
                }),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.pushNamed(context, AppRouter.qr),
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scanner'),
      ),
    );
  }
}
