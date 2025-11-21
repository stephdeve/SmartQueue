
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartqueue_user/core/app_router.dart';
import 'package:smartqueue_user/core/app_theme.dart';

void main() {
  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'SmartQueue',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      initialRoute: AppRouter.splash,
      onGenerateRoute: AppRouter.generateRoute,
      builder: (context, child) {
        return ScrollConfiguration(
          behavior: const ScrollBehavior().copyWith(overscroll: false),
          child: child!,
        );
      },
    );
  }
}