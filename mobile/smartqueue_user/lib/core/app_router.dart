import 'package:flutter/material.dart';
import '../features/home/home_screen.dart';
import '../features/splash/splash_screen.dart';
import '../features/auth/login_screen.dart';
import '../features/shell/app_shell.dart';
import '../features/services/services_screen.dart';
import '../features/service_detail/service_detail_screen.dart';
import '../features/realtime/realtime_screen.dart';
import '../features/ticket/take_ticket_screen.dart';
import '../features/qr/qr_scanner_screen.dart';
import '../features/notifications/notifications_screen.dart';
import '../features/history/history_screen.dart';
import '../features/profile/profile_screen.dart';

// Déclare les routes nommées et leurs écrans
class AppRouter {
  static const home = '/';
  static const login = '/login';
  static const homeList = '/home';
  static const services = '/services';
  static const serviceDetail = '/service_detail';
  static const realtime = '/realtime';
  static const takeTicket = '/take_ticket';
  static const qr = '/qr';
  static const notifications = '/notifications';
  static const history = '/history';
  static const profile = '/profile';

  static Route<dynamic> onGenerateRoute(RouteSettings settings) {
    switch (settings.name) {
      case home:
        return MaterialPageRoute(builder: (_) => const SplashScreen());
      case login:
        return MaterialPageRoute(builder: (_) => const LoginScreen());
      case homeList:
        return MaterialPageRoute(builder: (_) => const AppShell());
      case services:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => ServicesScreen(
            establishmentId: m['establishmentId'] as int,
            establishmentName: m['establishmentName'] as String,
          ),
        );
      case serviceDetail:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => ServiceDetailScreen(
            serviceId: m['serviceId'] as int,
            serviceName: m['serviceName'] as String,
          ),
        );
      case takeTicket:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => TakeTicketScreen(
            serviceId: m['serviceId'] as int,
            serviceName: m['serviceName'] as String,
          ),
        );
      case realtime:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => RealtimeScreen(
            ticketId: m['ticketId'] as int,
            serviceName: m['serviceName'] as String,
          ),
        );
      case qr:
        return MaterialPageRoute(builder: (_) => const QrScannerScreen());
      case notifications:
        return MaterialPageRoute(builder: (_) => const NotificationsScreen());
      case history:
        return MaterialPageRoute(builder: (_) => const HistoryScreen());
      case profile:
        return MaterialPageRoute(builder: (_) => const ProfileScreen());
      default:
        return MaterialPageRoute(builder: (_) => const HomeScreen());
    }
  }
}
