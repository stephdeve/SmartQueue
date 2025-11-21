import '../api_client.dart';
import '../models/notification_item.dart';
import '../../core/config.dart';
import 'package:dio/dio.dart';

/// Accès API aux notifications utilisateur
class NotificationsRepository {
  final ApiClient _client;
  NotificationsRepository(this._client);

  Future<List<NotificationItem>> list({int? perPage}) async {
    try {
      final res = await _client.dio.get(
        AppConfig.notifications,
        queryParameters: { if (perPage != null) 'per_page': perPage },
      );
      final data = res.data is Map && res.data['data'] is List ? res.data['data'] : res.data;
      return (data as List).map((e) => NotificationItem.fromJson(e as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) {
        return <NotificationItem>[];
      }
      rethrow;
    }
  }

  Future<void> markAsRead(int id) async {
    try {
      // Try POST /notifications/{id}/read; fallback to PUT if needed
      try {
        await _client.dio.post(AppConfig.notificationRead(id));
      } on DioException catch (e) {
        if (e.response?.statusCode == 405) {
          await _client.dio.put(AppConfig.notificationRead(id));
        } else if (e.response?.statusCode == 404) {
          return; // tolerant
        } else {
          rethrow;
        }
      }
    } on DioException {
      rethrow;
    }
  }

  Future<void> delete(int id) async {
    try {
      await _client.dio.delete(AppConfig.notificationById(id));
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return; // already gone
      rethrow;
    }
  }
}
