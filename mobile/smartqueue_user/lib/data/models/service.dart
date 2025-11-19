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
        id: j['id'] as int,
        name: j['name'] as String,
        status: j['status'] as String,
        avgServiceTimeMinutes: (j['avg_service_time_minutes'] as int?) ?? 10,
        establishmentId: j['establishment_id'] as int,
      );
}
