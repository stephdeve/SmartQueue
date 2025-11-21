import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartqueue_user/core/app_theme.dart';
import 'package:smartqueue_user/features/notifications/notifications_provider.dart';

class NotificationsScreen extends ConsumerWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncNotifications = ref.watch(notificationsProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(notificationsProvider),
          ),
        ],
      ),
      body: asyncNotifications.when(
        data: (notifications) {
          if (notifications.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.notifications_off_outlined,
                    size: 64,
                    color: Colors.grey[400],
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Aucune notification',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Vous n\'avez pas encore de notifications',
                    style: AppTheme.bodyMedium,
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => ref.refresh(notificationsProvider.future),
            child: ListView.builder(
              itemCount: notifications.length,
              itemBuilder: (context, index) {
                final notification = notifications[index];
                return Dismissible(
                  key: ValueKey(notification.id),
                  background: Container(
                    color: AppTheme.errorColor,
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    child: const Icon(
                      Icons.delete_outline,
                      color: Colors.white,
                    ),
                  ),
                  direction: DismissDirection.endToStart,
                  confirmDismiss: (direction) async {
                    // TODO: Implement delete notification
                    return false;
                  },
                  child: Card(
                    margin: const EdgeInsets.symmetric(
                      vertical: 4,
                      horizontal: 8,
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      leading: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: _getNotificationColor(notification.type)
                              .withOpacity(0.1),
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          _getNotificationIcon(notification.type),
                          color: _getNotificationColor(notification.type),
                        ),
                      ),
                      title: Text(
                        notification.title,
                        style: const TextStyle(fontWeight: FontWeight.w500),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: 4),
                          Text(notification.body ?? ''),
                          const SizedBox(height: 4),
                          Text(
                            _relativeTime(notification.createdAt),
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppTheme.textSecondary,
                            ),
                          ),
                        ],
                      ),
                      onTap: () {
                        // TODO: Handle notification tap
                      },
                    ),
                  ),
                );
              },
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
                onPressed: () => ref.refresh(notificationsProvider),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  IconData _getNotificationIcon(String? type) {
    switch (type) {
      case 'ticket_called':
        return Icons.notifications_active_outlined;
      case 'ticket_updated':
        return Icons.update_outlined;
      case 'announcement':
        return Icons.announcement_outlined;
      default:
        return Icons.notifications_none_outlined;
    }
  }

  Color _getNotificationColor(String? type) {
    switch (type) {
      case 'ticket_called':
        return Colors.green;
      case 'ticket_updated':
        return Colors.blue;
      case 'announcement':
        return Colors.orange;
      default:
        return AppTheme.primaryColor;
    }
  }

  String _relativeTime(DateTime? dt) {
    if (dt == null) return '';
    final now = DateTime.now();
    final diff = now.difference(dt);
    if (diff.inSeconds < 60) return "à l'instant";
    if (diff.inMinutes < 60) return 'Il y a ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'Il y a ${diff.inHours} h';
    if (diff.inDays < 7) return 'Il y a ${diff.inDays} j';
    return '${dt.day.toString().padLeft(2, '0')}/${dt.month.toString().padLeft(2, '0')}/${dt.year}';
  }
}