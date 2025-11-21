import '../api_client.dart';
import '../models/ticket.dart';
import '../../core/config.dart';
import 'package:dio/dio.dart';

class TicketsRepository {
  final ApiClient _client;
  TicketsRepository(this._client);

  Future<Ticket> create(int serviceId) async {
    try {
      final res = await _client.dio.post(AppConfig.createTicket, data: {'service_id': serviceId});
      final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
      return Ticket.fromJson((data as Map).cast<String, dynamic>());
    } on DioException catch (e) {
      // If backend returns 422, surface a friendly message and try alt key
      if (e.response?.statusCode == 422) {
        final body = e.response?.data;
        String msg = 'Impossible de prendre un ticket (422).';
        if (body is Map) {
          final m = body.cast<String, dynamic>();
          if (m['message'] is String) msg = m['message'] as String;
          if (m['errors'] is Map) {
            final err = (m['errors'] as Map).cast<String, dynamic>();
            final lines = <String>[];
            err.forEach((k, v) {
              if (v is List && v.isNotEmpty) lines.add('${k}: ${v.first}');
            });
            if (lines.isNotEmpty) msg = lines.join('\n');
          }
        }
        // Try alternate payload key once
        try {
          final res2 = await _client.dio.post(AppConfig.createTicket, data: {'serviceId': serviceId});
          final data2 = res2.data is Map && res2.data['data'] != null ? res2.data['data'] : res2.data;
          return Ticket.fromJson((data2 as Map).cast<String, dynamic>());
        } catch (_) {
          throw Exception(msg);
        }
      }
      rethrow;
    }
  }

  Future<List<Ticket>> active() async {
    final res = await _client.dio.get(AppConfig.activeTickets);
    final data = res.data is Map && res.data['data'] is List ? res.data['data'] : res.data;
    return (data as List).map((e) => Ticket.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<List<Ticket>> history({int? perPage}) async {
    final res = await _client.dio.get(AppConfig.historyTickets, queryParameters: {
      if (perPage != null) 'per_page': perPage,
    });
    final data = res.data is Map && res.data['data'] is List ? res.data['data'] : res.data;
    return (data as List).map((e) => Ticket.fromJson((e as Map).cast<String, dynamic>())).toList();
  }

  Future<Ticket> byId(int id) async {
    final res = await _client.dio.get(AppConfig.ticketById(id));
    final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
    return Ticket.fromJson((data as Map).cast<String, dynamic>());
  }

  Future<void> cancel(int id) async {
    try {
      await _client.dio.post(AppConfig.ticketCancel(id));
    } on DioException catch (_) {
      // Fallback on DELETE if cancel route not available
      try {
        await _client.dio.delete(AppConfig.ticketById(id));
      } on DioException catch (e2) {
        String msg = 'Annulation impossible.';
        final data = e2.response?.data;
        if (data is Map && data['message'] is String) {
          msg = data['message'] as String;
        }
        throw Exception(msg);
      }
    }
  }
}
