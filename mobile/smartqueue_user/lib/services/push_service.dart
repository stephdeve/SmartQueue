import 'dart:convert';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:smartqueue_user/core/app_router.dart';
import 'package:smartqueue_user/firebase_options.dart';

/// Service push (FCM) – nécessite la configuration Firebase (voir README)
class PushService {
  static final _local = FlutterLocalNotificationsPlugin();

  static Future<void> init() async {
    try {
      if (Firebase.apps.isEmpty) {
        await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
      }
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission(alert: true, badge: true, sound: true);

      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const init = InitializationSettings(android: androidInit);
      await _local.initialize(
        init,
        onDidReceiveNotificationResponse: (response) {
          _navigateFromPayload(response.payload);
        },
      );

      FirebaseMessaging.onMessage.listen((msg) async {
        final n = msg.notification;
        if (n != null) {
          await _local.show(
            0,
            n.title,
            n.body,
            const NotificationDetails(
              android: AndroidNotificationDetails(
                'default_channel',
                'Notifications',
                importance: Importance.high,
                priority: Priority.high,
              ),
            ),
            payload: jsonEncode(msg.data),
          );
        }
      });
    } catch (e, st) {
      debugPrint('PushService.init failed: $e\n$st');
    }
  }

  static Future<void> setupInteractedMessages() async {
    try {
      // When app is in background and user taps the notification
      FirebaseMessaging.onMessageOpenedApp.listen(_navigateFromMessage);

      // When app is terminated and launched by tapping the notification
      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          _navigateFromMessage(initialMessage);
        });
      }
    } catch (e, st) {
      debugPrint('PushService.setupInteractedMessages failed: $e\n$st');
    }
  }

  static void _navigateFromMessage(RemoteMessage message) {
    final data = message.data;
    _navigateFromData(data);
  }

  static void _navigateFromPayload(String? payload) {
    if (payload == null || payload.isEmpty) return;
    try {
      final data = jsonDecode(payload) as Map<String, dynamic>;
      _navigateFromData(data);
    } catch (_) {}
  }

  static void _navigateFromData(Map<String, dynamic> data) {
    final nav = AppRouter.navigatorKey.currentState;
    if (nav == null) return;

    // Try to infer target screen from data
    final screen = (data['screen'] ?? data['type'] ?? '').toString();
    final idStr = data['ticket_id'] ?? data['ticketId'] ?? data['id'];
    final ticketId = idStr != null ? int.tryParse('$idStr') : null;
    final serviceName = (data['service_name'] ?? data['serviceName'] ?? 'Ticket').toString();

    if (ticketId != null) {
      if (screen == 'realtime') {
        nav.pushNamed(AppRouter.realtime, arguments: {
          'ticketId': ticketId,
          'serviceName': serviceName,
        });
        return;
      }
      if (screen == 'ticket_called' || screen == 'ticket_updated') {
        nav.pushNamed(AppRouter.ticketDetail, arguments: {
          'ticketId': ticketId,
          'serviceName': serviceName,
        });
        return;
      }
    }

    // Fallback: open notifications list
    nav.pushNamed(AppRouter.notifications);
  }
}

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    if (Firebase.apps.isEmpty) {
      await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
    }
  } catch (_) {}
}

// Utilitaire pour récupérer le token FCM courant
extension PushServiceToken on PushService {
  static Future<String?> getFcmToken() async {
    try {
      return await FirebaseMessaging.instance.getToken();
    } catch (_) {
      return null;
    }
  }
}
