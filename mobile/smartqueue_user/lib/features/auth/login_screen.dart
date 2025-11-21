// features/auth/login_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:smartqueue_user/core/app_theme.dart';
import 'package:smartqueue_user/features/auth/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final success = await ref.read(authProvider.notifier).login(
          _emailController.text.trim(),
          _passwordController.text,
        );

    if (mounted && success) {
      Navigator.pushReplacementNamed(context, '/home');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 48),
                // Logo
                Icon(
                  Icons.qr_code_scanner,
                  size: 80,
                  color: Theme.of(context).primaryColor,
                ),
                const SizedBox(height: 24),
                // Title
                Text(
                  'Bienvenue sur SmartQueue',
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.primary,
                      ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                const Text(
                  'Connectez-vous pour gérer vos files d\'attente',
                  style: AppTheme.bodyMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 48),
                // Email Field
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Veuillez entrer votre email';
                    }
                    if (!value.contains('@')) {
                      return 'Veuillez entrer un email valide';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                // Password Field
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Mot de passe',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword
                            ? Icons.visibility_outlined
                            : Icons.visibility_off_outlined,
                      ),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Veuillez entrer votre mot de passe';
                    }
                    if (value.length < 6) {
                      return 'Le mot de passe doit contenir au moins 6 caractères';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),
                // Login Button
                ElevatedButton(
                  onPressed: authState.isLoading ? null : _submit,
                  child: authState.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : const Text('Se connecter'),
                ),
                const SizedBox(height: 16),
                // Error Message
                if (authState.error != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 16.0),
                    child: Text(
                      authState.error!,
                      style: const TextStyle(color: AppTheme.errorColor),
                      textAlign: TextAlign.center,
                    ),
                  ),
                // Forgot Password
                TextButton(
                  onPressed: () {
                    // TODO: Implement forgot password
                  },
                  child: const Text('Mot de passe oublié ?'),
                ),
                const SizedBox(height: 24),
                // Divider
                Row(
                  children: const [
                    Expanded(child: Divider()),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16.0),
                      child: Text('OU'),
                    ),
                    Expanded(child: Divider()),
                  ],
                ),
                const SizedBox(height: 24),
                // Register Button
                OutlinedButton(
                  onPressed: () {
                    Navigator.pushNamed(context, '/register');
                  },
                  child: const Text('Créer un compte'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}