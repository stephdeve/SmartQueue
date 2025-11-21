// Modèle d'établissement (utilisateur)
class Establishment {
  final int id;
  final String name;
  final double latitude;
  final double longitude;
  final String? address;
  final String affluence; // low | medium | high

  Establishment({
    required this.id,
    required this.name,
    required this.latitude,
    required this.longitude,
    this.address,
    required this.affluence,
  });

  factory Establishment.fromJson(Map<String, dynamic> j) => Establishment(
        id: j['id'] is int ? j['id'] as int : int.tryParse('${j['id']}') ?? -1,
        name: (j['name'] as String?) ?? (j['title'] as String?) ?? 'Établissement',
        latitude: _toDouble(j['latitude'] ?? j['lat']),
        longitude: _toDouble(j['longitude'] ?? j['lng']),
        address: (j['address'] as String?) ?? (j['location'] as String?),
        affluence: (j['affluence'] as String?) ?? 'medium',
      );

  static double _toDouble(Object? v) {
    if (v is num) return v.toDouble();
    return double.tryParse(v?.toString() ?? '') ?? 0.0;
  }
}
