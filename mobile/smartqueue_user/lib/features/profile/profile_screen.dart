import 'package:flutter/material.dart';

/// Profil utilisateur (mock UI)
class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Profil')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 28,
                  child: Text('U', style: Theme.of(context).textTheme.titleLarge),
                ),
                const SizedBox(width: 12),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text('Utilisateur', style: TextStyle(fontWeight: FontWeight.bold)),
                    Text('user@example.com', style: TextStyle(color: Colors.grey)),
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
          ],
        ),
      ),
    );
  }
}
