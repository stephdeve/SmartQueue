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
        id: j['id'] as int,
        name: j['name'] as String,
        latitude: (j['latitude'] as num).toDouble(),
        longitude: (j['longitude'] as num).toDouble(),
        address: j['address'] as String?,
        affluence: (j['affluence'] as String?) ?? 'medium',
      );
}
