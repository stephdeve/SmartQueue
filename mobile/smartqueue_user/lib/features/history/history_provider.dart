import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../data/repositories/tickets_repository.dart';

final historyTicketsProvider = FutureProvider.autoDispose((ref) async {
  final api = await ApiClient.create();
  final repo = TicketsRepository(api);
  return repo.history(perPage: 50);
});
