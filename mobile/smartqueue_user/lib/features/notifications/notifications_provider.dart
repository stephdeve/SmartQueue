import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../data/repositories/notifications_repository.dart';
import '../../data/models/notification_item.dart';

/// Provider pour charger la liste des notifications utilisateur
final notificationsProvider = FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
  final api = await ApiClient.create();
  final repo = NotificationsRepository(api);
  return repo.list(perPage: 50);
});
