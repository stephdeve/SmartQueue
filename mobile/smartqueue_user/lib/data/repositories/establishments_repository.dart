import '../api_client.dart';
import '../models/establishment.dart';
import '../../core/config.dart';

class EstablishmentsRepository {
  final ApiClient _client;
  EstablishmentsRepository(this._client);

  Future<List<Establishment>> nearby(double lat, double lng, {int? radius, int? perPage}) async {
    final res = await _client.dio.get(
      AppConfig.establishments,
      queryParameters: {
        'lat': lat,
        'lng': lng,
        if (radius != null) 'radius': radius,
        if (perPage != null) 'per_page': perPage,
      },
    );
    final data = res.data is Map && res.data['data'] is List ? res.data['data'] : res.data;
    return (data as List).map((e) => Establishment.fromJson(e)).toList();
  }
}
