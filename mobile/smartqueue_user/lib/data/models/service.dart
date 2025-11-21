class ServiceModel {
  final int id;
  final String name;
  final String status; // open | closed
  final int avgServiceTimeMinutes;
  final int establishmentId;

  ServiceModel({
    required this.id,
    required this.name,
    required this.status,
    required this.avgServiceTimeMinutes,
    required this.establishmentId,
  });

  factory ServiceModel.fromJson(Map<String, dynamic> j) => ServiceModel(
        id: _toInt(j['id']),
        name: (j['name'] as String?) ?? (j['title'] as String?) ?? 'Service',
        status: (j['status'] as String?) ?? 'open',
        avgServiceTimeMinutes: _toInt(j['avg_service_time_minutes'] ?? j['avgTime'] ?? 10),
        establishmentId: _toInt(j['establishment_id'] ?? j['establishmentId']),
      );

  static int _toInt(Object? v) => int.tryParse(v?.toString() ?? '') ?? 0;
}
