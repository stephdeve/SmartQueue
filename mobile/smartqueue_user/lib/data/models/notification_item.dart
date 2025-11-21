// Modèle de notification utilisateur
class NotificationItem {
  final int id;
  final String title;
  final String? body;
  final DateTime? createdAt;
  final String? type;
  final int? ticketId;
  final String? serviceName;

  NotificationItem({
    required this.id,
    required this.title,
    this.body,
    this.createdAt,
    this.type,
    this.ticketId,
    this.serviceName,
  });

  factory NotificationItem.fromJson(Map<String, dynamic> j) => NotificationItem(
        id: j['id'] is int ? j['id'] as int : int.tryParse('${j['id']}') ?? -1,
        title: (j['title'] as String?) ?? (j['subject'] as String?) ?? 'Notification',
        body: (j['body'] as String?) ?? (j['message'] as String?),
        createdAt: _parseDate(j['created_at'] ?? j['createdAt']),
        type: (j['type'] as String?) ?? (j['event'] as String?),
        ticketId: _parseInt((j['ticket_id']) ?? (j['ticketId']) ?? _extractData(j)['ticket_id'] ?? _extractData(j)['ticketId'] ?? _extractData(j)['id']),
        serviceName: (j['service_name'] as String?) ?? (j['serviceName'] as String?) ?? (_extractData(j)['service_name'] as String?) ?? (_extractData(j)['serviceName'] as String?),
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

  static Map<String, dynamic> _extractData(Map<String, dynamic> j) {
    final d = j['data'];
    return d is Map<String, dynamic> ? d : const {};
  }

  static int? _parseInt(Object? v) {
    if (v == null) return null;
    if (v is int) return v;
    return int.tryParse('$v');
  }
}
