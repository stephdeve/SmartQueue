class Ticket {
  final int id;
  final String ticketNumber;
  final String status; // created | waiting | called | closed | absent
  final int serviceId;
  final int? position;
  final int? etaMinutes;

  Ticket({
    required this.id,
    required this.ticketNumber,
    required this.status,
    required this.serviceId,
    this.position,
    this.etaMinutes,
  });

  factory Ticket.fromJson(Map<String, dynamic> j) => Ticket(
        id: j['id'] as int,
        ticketNumber: j['ticket_number'] as String,
        status: j['status'] as String,
        serviceId: j['service_id'] as int,
        position: j['position'] as int?,
        etaMinutes: j['eta_minutes'] as int?,
      );
}
