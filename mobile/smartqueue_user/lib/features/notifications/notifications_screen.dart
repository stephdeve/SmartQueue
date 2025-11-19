import 'package:flutter/material.dart';

/// Liste simple de notifications (mock UI)
class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
      body: ListView.separated(
        itemCount: 6,
        separatorBuilder: (_, __) => const Divider(height: 0),
        itemBuilder: (_, i) => ListTile(
          leading: const Icon(Icons.notifications),
          title: Text('Notification ${i + 1}'),
          subtitle: const Text('Contenu de la notification'),
          trailing: const Text('Il y a 2h'),
        ),
      ),
    );
  }
}
