import 'dart:async';
import 'package:flutter/material.dart';
import '../../services/websocket_service.dart';
import '../../data/api_client.dart';
import '../../data/repositories/tickets_repository.dart';
import '../../data/models/ticket.dart';

/// Suivi en temps réel d'un ticket (exemple via WebSocket)
class RealtimeScreen extends StatefulWidget {
  final int ticketId;
  final String serviceName;
  const RealtimeScreen({super.key, required this.ticketId, required this.serviceName});

  @override
  State<RealtimeScreen> createState() => _RealtimeScreenState();
}

class _RealtimeScreenState extends State<RealtimeScreen> {
  final ws = WebSocketService();
  StreamSubscription? sub;
  Ticket? ticket;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final api = await ApiClient.create();
    final repo = TicketsRepository(api);
    ticket = await repo.byId(widget.ticketId);
    setState(() => loading = false);

    ws.connectToServiceChannel(ticket!.serviceId);
    sub = ws.stream.listen((event) {
      if (event['type'] == 'ticket.updated' && event['ticket_id'] == widget.ticketId) {
        setState(() => ticket = Ticket.fromJson(event['ticket']));
      }
    });
  }

  @override
  void dispose() {
    sub?.cancel();
    ws.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (loading || ticket == null) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    return Scaffold(
      appBar: AppBar(title: Text('Suivi • ${widget.serviceName}')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Ticket ${ticket!.ticketNumber}', style: Theme.of(context).textTheme.headlineSmall),
                const SizedBox(height: 8),
                Text('Statut: ${ticket!.status}'),
                const SizedBox(height: 12),
                if (ticket!.position != null) Text('Votre position: ${ticket!.position}'),
                if (ticket!.etaMinutes != null) Text('Estimation: ${ticket!.etaMinutes} min'),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
