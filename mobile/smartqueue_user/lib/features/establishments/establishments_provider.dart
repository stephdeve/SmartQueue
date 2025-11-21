import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartqueue_user/data/api_client.dart';
import 'package:smartqueue_user/data/repositories/establishments_repository.dart';
import 'package:smartqueue_user/services/location_service.dart';

final locationServiceProvider = Provider((ref) => LocationService());

final nearbyEstablishmentsProvider = FutureProvider.autoDispose((ref) async {
  final api = await ApiClient.create();
  final repo = EstablishmentsRepository(api);
  final loc = ref.read(locationServiceProvider);
  final pos = await loc.currentPosition();
  if (pos == null) return <dynamic>[];
  return repo.nearby(pos.latitude, pos.longitude);
});
