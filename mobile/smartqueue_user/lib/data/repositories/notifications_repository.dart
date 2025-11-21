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
}
