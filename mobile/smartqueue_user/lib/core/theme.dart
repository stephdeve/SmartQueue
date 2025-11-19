import 'package:flutter/material.dart';

// Thème Material 3 avec une couleur "seed" cohérente (bleu SQ)
ThemeData buildTheme(Brightness brightness) {
  final seed = const Color(0xFF2563EB);
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: seed, brightness: brightness),
    appBarTheme: const AppBarTheme(centerTitle: true),
    visualDensity: VisualDensity.adaptivePlatformDensity,
  );
}
