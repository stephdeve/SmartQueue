import '../api_client.dart';
import '../models/service.dart';
import '../../core/config.dart';

class ServicesRepository {
  final ApiClient _client;
  ServicesRepository(this._client);

  Future<List<ServiceModel>> byEstablishment(int estId) async {
    final res = await _client.dio.get(AppConfig.servicesByEst(estId));
    final data = res.data is Map && res.data['data'] is List ? res.data['data'] : res.data;
    return (data as List).map((e) => ServiceModel.fromJson(e)).toList();
  }

  Future<ServiceModel> detail(int id) async {
    final res = await _client.dio.get(AppConfig.serviceDetail(id));
    final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
    return ServiceModel.fromJson(data);
  }
}
