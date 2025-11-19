import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/api_client.dart';
import '../../data/repositories/tickets_repository.dart';
import '../../data/models/ticket.dart';

class TicketController extends AsyncNotifier<Ticket?> {
  @override
  FutureOr<Ticket?> build() => null;

  Future<void> take(int serviceId) async {
    state = const AsyncValue.loading();
    try {
      final api = await ApiClient.create();
      final repo = TicketsRepository(api);
      final t = await repo.create(serviceId);
      state = AsyncValue.data(t);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
    }
  }
}

final ticketProvider = AsyncNotifierProvider<TicketController, Ticket?>(TicketController.new);
