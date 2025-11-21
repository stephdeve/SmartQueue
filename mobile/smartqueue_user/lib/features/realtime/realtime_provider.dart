import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartqueue_user/data/api_client.dart';
import 'package:smartqueue_user/data/models/ticket.dart';
import 'package:smartqueue_user/data/repositories/tickets_repository.dart';

/// Fournit l'état courant d'un ticket (fetch simple; temps réel à améliorer via WebSocket)
final ticketRealtimeProvider = FutureProvider.family<Ticket, int>((ref, ticketId) async {
  final api = await ApiClient.create();
  final repo = TicketsRepository(api);
  return repo.byId(ticketId);
});
