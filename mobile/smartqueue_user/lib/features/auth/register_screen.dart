import 'package:flutter/material.dart';

class RegisterScreen extends StatelessWidget {
  const RegisterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Créer un compte')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.person_add_alt_1_outlined, size: 64),
              const SizedBox(height: 16),
              const Text('Écran d\'inscription (à implémenter)'),
              const SizedBox(height: 24),
              OutlinedButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Retour'),
              )
            ],
          ),
        ),
      ),
    );
  }
}
