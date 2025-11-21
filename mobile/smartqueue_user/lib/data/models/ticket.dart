class Ticket {
  final int id;
  final String ticketNumber;
  final String status; // created | waiting | called | closed | absent
  final int serviceId;
  final int? position;
  final int? etaMinutes;
  final String? serviceName;
  final DateTime? updatedAt;

  Ticket({
    required this.id,
    required this.ticketNumber,
    required this.status,
    required this.serviceId,
    this.position,
    this.etaMinutes,
    this.serviceName,
    this.updatedAt,
  });

  factory Ticket.fromJson(Map<String, dynamic> j) => Ticket(
        id: _toInt(j['id']),
        ticketNumber: _toString(j['ticket_number'] ?? j['ticketNumber'] ?? j['number'] ?? j['code'] ?? ''),
        status: (j['status'] as String?) ?? 'waiting',
        serviceId: _toInt(j['service_id'] ?? j['serviceId']),
        position: _toIntOrNull(j['position']),
        etaMinutes: _toIntOrNull(j['eta_minutes'] ?? j['etaMinutes']),
        serviceName: (j['service_name'] as String?) ?? (j['serviceName'] as String?),
        updatedAt: _parseDate(j['updated_at'] ?? j['updatedAt']),
      );

  static int _toInt(Object? v) => int.tryParse(v?.toString() ?? '') ?? -1;
  static int? _toIntOrNull(Object? v) => v == null ? null : int.tryParse(v.toString());
  static String _toString(Object? v) => v?.toString() ?? '';
  static DateTime? _parseDate(Object? v) {
    if (v == null) return null;
    if (v is String) return DateTime.tryParse(v);
    return null;
  }
}
