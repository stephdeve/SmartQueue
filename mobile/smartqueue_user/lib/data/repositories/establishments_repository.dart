import '../api_client.dart';
import '../models/establishment.dart';
import '../../core/config.dart';
import 'package:dio/dio.dart';
import 'dart:math' as math;

class EstablishmentsRepository {
  final ApiClient _client;
  EstablishmentsRepository(this._client);

  Future<List<Establishment>> nearby(double lat, double lng, {int? radius, int? perPage}) async {
    try {
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
    } on DioException catch (e) {
      // Fallback si le backend (SQLite) n'a pas les fonctions trigonométriques (SQRT/SIN/COS/ASIN...)
      if (e.response?.statusCode == 500) {
        final res2 = await _client.dio.get(
          AppConfig.establishments,
          queryParameters: {
            if (perPage != null) 'per_page': perPage,
          },
        );
        final data2 = res2.data is Map && res2.data['data'] is List ? res2.data['data'] : res2.data;
        final list = (data2 as List).map((e) => Establishment.fromJson(e)).toList();
        // Tri côté client par distance approximative (Haversine)
        double _dist(double la1, double lo1, double la2, double lo2) {
          const p = 0.017453292519943295; // pi/180
          final a = 0.5 - math.cos((la2 - la1) * p) / 2 +
              math.cos(la1 * p) * math.cos(la2 * p) * (1 - math.cos((lo2 - lo1) * p)) / 2;
          return 12742e3 * math.asin(math.sqrt(a)); // mètres
        }
        list.sort((a, b) => _dist(lat, lng, a.latitude, a.longitude).compareTo(_dist(lat, lng, b.latitude, b.longitude)));
        return list;
      }
      rethrow;
    }
  }
}
