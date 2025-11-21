import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'auth_repository.dart';

class AuthState {
  final bool isLoading;
  final String? error;
  const AuthState({this.isLoading = false, this.error});

  AuthState copyWith({bool? isLoading, String? error}) =>
      AuthState(isLoading: isLoading ?? this.isLoading, error: error);
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() => const AuthState();

  Future<bool> login(String email, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final repo = await AuthRepository.create();
      await repo.login(email: email, password: password);
      state = state.copyWith(isLoading: false, error: null);
      return true;
    } catch (e) {
      state = state.copyWith(
        isLoading: false,
        error: e.toString().replaceFirst('Exception: ', ''),
      );
      return false;
    }
  }

  Future<void> logout() async {
    try {
      final repo = await AuthRepository.create();
      await repo.logout();
    } catch (_) {}
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
