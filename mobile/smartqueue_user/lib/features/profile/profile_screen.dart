import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'profile_provider.dart';
import '../auth/auth_repository.dart';
import '../../core/app_router.dart';

/// Profil utilisateur (mock UI)
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncUser = ref.watch(currentUserProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: asyncUser.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Erreur: $e')),
        data: (user) {
          final name = user?.name ?? 'Utilisateur';
          final email = user?.email ?? 'non connecté';
          final initials = (name.isNotEmpty ? name[0] : 'U').toUpperCase();
          return Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      child: Text(initials, style: Theme.of(context).textTheme.titleLarge),
                    ),
                    const SizedBox(width: 12),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                        Text(email, style: const TextStyle(color: Colors.grey)),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const Text('Préférences', style: TextStyle(fontWeight: FontWeight.bold)),
                const SizedBox(height: 8),
                SwitchListTile(
                  value: true,
                  onChanged: (_) {},
                  title: const Text('Notifications push'),
                  subtitle: const Text('Recevoir des alertes sur l’avancée de la file'),
                ),
                const Spacer(),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: user == null
                            ? () => Navigator.pushReplacementNamed(context, AppRouter.login)
                            : () async {
                                final repo = await AuthRepository.create();
                                await repo.logout();
                                if (context.mounted) {
                                  Navigator.pushNamedAndRemoveUntil(context, AppRouter.login, (_) => false);
                                }
                              },
                        child: Text(user == null ? 'Se connecter' : 'Se déconnecter'),
                      ),
                    ),
                  ],
                )
              ],
            ),
          );
        },
      ),
    );
  }
}
