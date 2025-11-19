import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../data/repositories/services_repository.dart';

final servicesByEstablishmentProvider = FutureProvider.family((ref, int estId) async {
  final api = await ApiClient.create();
  final repo = ServicesRepository(api);
  return repo.byEstablishment(estId);
});
