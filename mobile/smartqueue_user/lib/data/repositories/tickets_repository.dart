import '../api_client.dart';
import '../models/ticket.dart';
import '../../core/config.dart';

class TicketsRepository {
  final ApiClient _client;
  TicketsRepository(this._client);

  Future<Ticket> create(int serviceId) async {
    final res = await _client.dio.post(AppConfig.createTicket, data: {'service_id': serviceId});
    final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
    return Ticket.fromJson(data);
  }

  Future<List<Ticket>> active() async {
    final res = await _client.dio.get(AppConfig.activeTickets);
    final data = res.data is Map && res.data['data'] is List ? res.data['data'] : res.data;
    return (data as List).map((e) => Ticket.fromJson(e)).toList();
  }

  Future<List<Ticket>> history({int? perPage}) async {
    final res = await _client.dio.get(AppConfig.historyTickets, queryParameters: {
      if (perPage != null) 'per_page': perPage,
    });
    final data = res.data is Map && res.data['data'] is List ? res.data['data'] : res.data;
    return (data as List).map((e) => Ticket.fromJson(e)).toList();
  }

  Future<Ticket> byId(int id) async {
    final res = await _client.dio.get(AppConfig.ticketById(id));
    final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
    return Ticket.fromJson(data);
  }
}
