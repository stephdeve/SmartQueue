import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../data/repositories/establishments_repository.dart';
import '../../services/location_service.dart';

final locationServiceProvider = Provider((ref) => LocationService());

final nearbyEstablishmentsProvider = FutureProvider.autoDispose((ref) async {
  final api = await ApiClient.create();
  final repo = EstablishmentsRepository(api);
  final loc = ref.read(locationServiceProvider);
  final pos = await loc.currentPosition();
  if (pos == null) return <dynamic>[];
  return repo.nearby(pos.latitude, pos.longitude);
});
