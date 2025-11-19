import 'package:flutter/material.dart';
import '../auth/auth_repository.dart';
import '../../core/app_router.dart';

/// Splash: décide si on va vers Login ou vers l'accueil selon présence du token
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    final repo = await AuthRepository.create();
    final (token, user) = await repo.current();
    if (!mounted) return;
    if (token == null) {
      Navigator.pushReplacementNamed(context, AppRouter.login);
    } else {
      Navigator.pushReplacementNamed(context, AppRouter.homeList);
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
