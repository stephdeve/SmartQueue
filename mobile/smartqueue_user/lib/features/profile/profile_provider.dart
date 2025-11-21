import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_repository.dart';
import '../../core/app_router.dart';

// Fournit l'utilisateur courant à partir du stockage (token + user sérialisé)
final currentUserProvider = FutureProvider.autoDispose((ref) async {
  final repo = await AuthRepository.create();
  final (token, user) = await repo.current();
  return user; // peut être null si non connecté
});
