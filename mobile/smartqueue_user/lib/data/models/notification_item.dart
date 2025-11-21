// Modèle de notification utilisateur
class NotificationItem {
  final int id;
  final String title;
  final String? body;
  final DateTime? createdAt;
  final String? type;

  NotificationItem({
    required this.id,
    required this.title,
    this.body,
    this.createdAt,
    this.type,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['id'] is int ? j['id'] as int : int.tryParse('${j['id']}') ?? -1,
        title: (j['title'] as String?) ?? (j['subject'] as String?) ?? 'Notification',
        body: (j['body'] as String?) ?? (j['message'] as String?),
        createdAt: _parseDate(j['created_at'] ?? j['createdAt']),
        type: (j['type'] as String?) ?? (j['event'] as String?),
      );

  static DateTime? _parseDate(Object? v) {
    if (v is String) {
      try {
        return DateTime.tryParse(v);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}
