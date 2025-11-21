import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Scanner QR pour lier un ticket / rejoindre une file
class QrScannerScreen extends StatefulWidget {
  const QrScannerScreen({super.key});

  @override
  State<QrScannerScreen> createState() => _QrScannerScreenState();
}

class _QrScannerScreenState extends State<QrScannerScreen> {
  final keyQR = GlobalKey(debugLabel: 'QR');
  MobileScannerController? controller;
  bool _handled = false;

  @override
  void initState() {
    super.initState();
    final c = MobileScannerController();
    _onQRViewCreated(c);
  }

  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  void _onQRViewCreated(MobileScannerController c) {
    controller = c;
    c.barcodes.listen((capture) async {
      final code = capture.barcodes.isNotEmpty ? (capture.barcodes.first.rawValue ?? '') : '';
      if (!mounted || _handled) return;
      if (code.isEmpty) return;

      Uri? uri;
      try {
        uri = Uri.tryParse(code);
      } catch (_) {}

      if (uri != null && uri.scheme == 'smartqueue') {
        _handled = true;
        await controller?.stop();
        final host = uri.host; // e.g. ticket or service
        if (host == 'ticket') {
          final idStr = uri.queryParameters['id'];
          final ticketId = int.tryParse(idStr ?? '');
          final serviceName = uri.queryParameters['name'] ?? 'Service';
          if (ticketId != null) {
            if (!mounted) return;
            Navigator.pushNamed(context, '/realtime', arguments: {
              'ticketId': ticketId,
              'serviceName': serviceName,
            });
            return;
          }
        } else if (host == 'service') {
          final idStr = uri.queryParameters['id'];
          final serviceId = int.tryParse(idStr ?? '');
          final serviceName = uri.queryParameters['name'] ?? 'Service';
          if (serviceId != null) {
            if (!mounted) return;
            Navigator.pushNamed(context, '/service_detail', arguments: {
              'serviceId': serviceId,
              'serviceName': serviceName,
            });
            return;
          }
        }
        // Format inconnu -> reprendre le flux et notifier
        _handled = false;
        await controller?.start();
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('QR non reconnu: $code')),
        );
        return;
      }

      // Affichage par défaut si URL non smartqueue
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('QR: $code')));
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Scanner un QR Code')),
      body: MobileScanner(key: keyQR, controller: controller),
    );
  }
}
