import 'package:flutter/material.dart';
import '../home/home_screen.dart';
import '../tickets/active_tickets_screen.dart';
import '../notifications/notifications_screen.dart';
import '../profile/profile_screen.dart';
import '../../core/app_router.dart';
import '../services/services_screen.dart';
import '../service_detail/service_detail_screen.dart';
import '../ticket/take_ticket_screen.dart';
import '../realtime/realtime_screen.dart';

/// Conteneur avec NavigationBar (Material 3)
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  int index = 0;
  final homeNavKey = GlobalKey<NavigatorState>();

  Route _homeOnGenerate(RouteSettings settings) {
    switch (settings.name) {
      case '/':
      case null:
        return MaterialPageRoute(builder: (_) => const HomeScreen());
      case AppRouter.services:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => ServicesScreen(
            establishmentId: m['establishmentId'] as int,
            establishmentName: m['establishmentName'] as String,
          ),
        );
      case AppRouter.serviceDetail:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => ServiceDetailScreen(
            serviceId: m['serviceId'] as int,
            serviceName: m['serviceName'] as String,
          ),
        );
      case AppRouter.takeTicket:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => TakeTicketScreen(
            serviceId: m['serviceId'] as int,
            serviceName: m['serviceName'] as String,
          ),
        );
      case AppRouter.realtime:
        final m = settings.arguments as Map;
        return MaterialPageRoute(
          builder: (_) => RealtimeScreen(
            ticketId: m['ticketId'] as int,
            serviceName: m['serviceName'] as String,
          ),
        );
      default:
        return MaterialPageRoute(builder: (_) => const HomeScreen());
    }
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: () async {
        if (index == 0 && homeNavKey.currentState != null && homeNavKey.currentState!.canPop()) {
          homeNavKey.currentState!.pop();
          return false;
        }
        return true;
      },
      child: Scaffold(
        body: SafeArea(
          child: IndexedStack(
            index: index,
            children: [
              // Flux Accueil → Services → Détails, conservé dans un Navigator imbriqué
              Navigator(
                key: homeNavKey,
                onGenerateRoute: (settings) => _homeOnGenerate(settings),
              ),
              // Tickets actifs
              const ActiveTicketsScreen(),
              // Notifications
              const NotificationsScreen(),
              // Profil
              const ProfileScreen(),
            ],
          ),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: (i) => setState(() => index = i),
          destinations: const [
            NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Accueil'),
            NavigationDestination(icon: Icon(Icons.confirmation_number_outlined), selectedIcon: Icon(Icons.confirmation_number), label: 'Tickets'),
            NavigationDestination(icon: Icon(Icons.notifications_outlined), selectedIcon: Icon(Icons.notifications), label: 'Notifications'),
            NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profil'),
          ],
        ),
      ),
    );
  }
}
