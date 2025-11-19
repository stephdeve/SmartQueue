import 'dart:convert';
import 'package:web_socket_channel/web_socket_channel.dart';
import '../core/config.dart';

/// WebSocket basique (adapter selon Pusher/Echo si nécessaire)
class WebSocketService {
  WebSocketChannel? _channel;

  void connectToServiceChannel(int serviceId) {
    final uri = Uri.parse('${AppConfig.wsUrl}/?service_id=$serviceId');
    _channel = WebSocketChannel.connect(uri);
  }

  Stream<Map<String, dynamic>> get stream async* {
    if (_channel == null) return;
    await for (final data in _channel!.stream) {
      try {
        yield json.decode(data as String) as Map<String, dynamic>;
      } catch (_) {}
    }
  }

  void disconnect() => _channel?.sink.close();
}
