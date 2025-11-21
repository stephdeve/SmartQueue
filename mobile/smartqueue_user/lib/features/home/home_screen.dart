// features/home/home_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartqueue_user/core/app_theme.dart';
import 'package:smartqueue_user/features/establishments/establishments_provider.dart';
import 'package:smartqueue_user/features/establishments/widgets/establishment_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncEstablishments = ref.watch(nearbyEstablishmentsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Établissements à proximité'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(nearbyEstablishmentsProvider),
          ),
        ],
      ),
      body: asyncEstablishments.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline, color: AppTheme.errorColor, size: 48),
              const SizedBox(height: 16),
              Text(
                'Erreur de chargement',
                style: AppTheme.heading2.copyWith(color: AppTheme.errorColor),
              ),
              const SizedBox(height: 8),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32.0),
                child: Text(
                  error.toString(),
                  textAlign: TextAlign.center,
                  style: AppTheme.bodyMedium,
                ),
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: () => ref.refresh(nearbyEstablishmentsProvider),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
        data: (establishments) {
          if (establishments.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.location_off, size: 64, color: AppTheme.textSecondary),
                  const SizedBox(height: 16),
                  Text(
                    'Aucun établissement à proximité',
                    style: AppTheme.heading2,
                  ),
                  const SizedBox(height: 8),
                  const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 32.0),
                    child: Text(
                      'Essayez d\'activer votre localisation ou d\'élargir la zone de recherche.',
                      textAlign: TextAlign.center,
                      style: AppTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.refresh(nearbyEstablishmentsProvider.future),
            child: ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: establishments.length,
              itemBuilder: (context, index) {
                final establishment = establishments[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4.0),
                  child: EstablishmentCard(establishment: establishment),
                );
              },
            ),
          );
        },
      ),
    );
  }
}